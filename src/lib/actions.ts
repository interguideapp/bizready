"use server";
import { randomBytes } from "node:crypto";
import { seal, open, sealingAvailable } from "@/lib/crypto-box";
import { sanitizeAnswers, sanitizeBusinessName } from "@/lib/validate-answers";

import { todayInIsrael } from "@/lib/dates";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TASK_TEMPLATES, TEMPLATES_BY_ID } from "@/lib/content";
import {
  buildPlan,
  profileFromAnswers,
  reconcilePlan,
  summarizeReconcile,
  type ReconcileSummary,
} from "@/lib/rules-engine";
import { isStatutoryFiling, nextStatutoryDueDate, STATUTORY_FILINGS } from "@/lib/compliance";
import { createClient } from "@/lib/supabase/server";
import { DISMISSAL_LABEL, isDismissal, type Dismissal } from "@/lib/task-status";
import {
  checkBackDate,
  positionOf,
  statusForStage,
  terminalStageFor,
} from "@/lib/content/milestones";
import { periodForDue } from "@/lib/filings";
import { deleteAccountCompletely } from "@/lib/privacy";
import { capLength, check } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/billing";
import { looksLikeEmail, normaliseEmail, type MemberRole } from "@/lib/members";
import { PROVIDERS_BY_ID } from "@/lib/integrations/registry";
import { executeBatch } from "@/lib/integrations/execute";
import type { OnboardingAnswers, TaskStatus } from "@/lib/types";

/**
 * The only columns the business card may write. The typed signatures on the
 * actions below are erased at runtime, so this set is the real boundary.
 */
const BUSINESS_CARD_FIELDS = new Set<string>([
  "name",
  "dealer_number",
  "vat_file",
  "income_tax_file",
  "bituach_leumi_file",
  "bank_name",
  "bank_branch",
  "bank_account",
  "accountant_name",
  "accountant_phone",
  "accountant_email",
]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Finish onboarding: create the business + its personalized plan. */
export async function completeOnboarding(
  businessNameInput: string,
  answersInput: OnboardingAnswers
) {
  const { supabase, user } = await requireUser();
  // never trust the client payload (see lib/validate-answers)
  const businessName = sanitizeBusinessName(businessNameInput);
  const answers = sanitizeAnswers(answersInput);

  const { data: business, error } = await supabase
    .from("businesses")
    .upsert(
      {
        owner_id: user.id,
        name: businessName,
        entity_type: answers.entity_type,
        field: answers.field,
        onboarding_answers: answers,
        onboarding_completed_at: new Date().toISOString(),
        started_at: todayInIsrael(),
      },
      { onConflict: "owner_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  const plan = buildPlan(answers, TASK_TEMPLATES);
  const { error: tasksError } = await supabase.from("business_tasks").upsert(
    plan.map((t) => ({
      business_id: business.id,
      template_id: t.template_id,
      status: t.status,
      due_date: t.due_date,
      completed_at: t.status === "done" ? new Date().toISOString() : null,
      is_relevant: true,
    })),
    { onConflict: "business_id,template_id" }
  );
  if (tasksError) throw new Error(tasksError.message);

  redirect("/plan-ready");
}

/**
 * Dry-run a profile change: what would recalibration add, hide, or bring back?
 * No writes — lets the settings form show the exact plan diff before committing
 * so כיול is a transparent, trusted action instead of a silent mutation.
 */
export async function previewReconcile(
  answersInput: OnboardingAnswers
): Promise<ReconcileSummary> {
  const { supabase, user } = await requireUser();
  const answers = sanitizeAnswers(answersInput);
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return { added: [], removed: [], restored: [], changed: false };

  const { data: existing } = await supabase
    .from("business_tasks")
    .select("template_id, is_relevant")
    .eq("business_id", business.id);

  const result = reconcilePlan(answers, TASK_TEMPLATES, existing ?? []);
  return summarizeReconcile(result, TEMPLATES_BY_ID);
}

/** Update answers from settings and reconcile the task list. */
export async function updateAnswers(
  answersInput: OnboardingAnswers
): Promise<ReconcileSummary> {
  const { supabase, user } = await requireUser();
  const answers = sanitizeAnswers(answersInput);

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { error } = await supabase
    .from("businesses")
    .update({
      entity_type: answers.entity_type,
      field: answers.field,
      onboarding_answers: answers,
    })
    .eq("id", business.id);
  if (error) throw new Error(error.message);

  const { data: existing } = await supabase
    .from("business_tasks")
    .select("template_id, is_relevant")
    .eq("business_id", business.id);

  const reconcile = reconcilePlan(answers, TASK_TEMPLATES, existing ?? []);
  const { toAdd, toFlagIrrelevant, toFlagRelevant } = reconcile;

  if (toAdd.length > 0) {
    await supabase.from("business_tasks").insert(
      toAdd.map((t) => ({
        business_id: business.id,
        template_id: t.template_id,
        status: t.status,
        due_date: t.due_date,
        is_relevant: true,
      }))
    );
  }
  if (toFlagIrrelevant.length > 0) {
    await supabase
      .from("business_tasks")
      .update({ is_relevant: false })
      .eq("business_id", business.id)
      .in("template_id", toFlagIrrelevant);
  }
  if (toFlagRelevant.length > 0) {
    await supabase
      .from("business_tasks")
      .update({ is_relevant: true })
      .eq("business_id", business.id)
      .in("template_id", toFlagRelevant);
  }

  // reporting frequency (or entity) may have changed — re-anchor the real
  // statutory deadlines on the open filing tasks so the dates stay correct.
  const profile = profileFromAnswers(answers);
  const today = new Date();
  for (const templateId of STATUTORY_FILINGS) {
    await supabase
      .from("business_tasks")
      .update({ due_date: nextStatutoryDueDate(templateId, today, profile) })
      .eq("business_id", business.id)
      .eq("template_id", templateId)
      .neq("status", "done");
  }

  revalidatePath("/", "layout");
  return summarizeReconcile(reconcile, TEMPLATES_BY_ID);
}

/**
 * Move a task between the non-done statuses. Completing a task goes through
 * `completeTask` instead — it requires evidence.
 */
/**
 * Move a task to the next אבן דרך — the one click that replaces four.
 *
 * Before this, finishing a submission meant: open the task, switch to the
 * "לסגור" tab, pick "ממתין", type what you were waiting for, and choose a
 * follow-up date. Every one of those four was something the product already
 * knew from the task's own milestone chain. So the client sends no state at
 * all here — only which stage it believed the task was on — and the server
 * derives the rest.
 *
 * `fromStageId` is optimistic concurrency, not ceremony. Advancing is a single
 * tap on a screen that may have been open for a while, and without this a
 * double tap or a stale tab would silently skip a stage — which for a filing
 * would mean the product recording a payment that never happened.
 */
export async function advanceStage(taskId: string, fromStageId: string) {
  const { supabase } = await requireUser();

  const { data: current, error: readError } = await supabase
    .from("business_tasks")
    .select("id, business_id, template_id, status, stage")
    .eq("id", taskId)
    .single();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("task not found");

  const position = positionOf({
    template_id: current.template_id,
    stage: current.stage,
    status: current.status,
  });

  // Refuse to act on a stale view rather than guessing which stage the user
  // meant. The caller re-reads and shows the real position.
  if (position.stage.id !== fromStageId) {
    throw new Error("STALE_STAGE");
  }

  const next = position.next;
  if (!next) return;

  // The final hand-over belongs to the completion flow, which captures
  // evidence into the hash-chained trail and writes real numbers onto the
  // business card. Closing a task from here would bypass both, so this refuses
  // even though the UI already routes that click elsewhere.
  if (position.advanceCompletes) {
    throw new Error("NEEDS_COMPLETION_FLOW");
  }

  const nextIndex = position.index + 1;
  const status = statusForStage(position.chain, nextIndex);

  const { error } = await supabase
    .from("business_tasks")
    .update({
      stage: next.id,
      status,
      // Derived, not typed. A hand-off names the specific thing being waited
      // on; anything else clears it, so a task cannot keep claiming it is
      // waiting for something once the ball is back with the user.
      waiting_for: next.owner === "them" ? next.label : null,
      follow_up_date: checkBackDate(next, todayInIsrael()),
      completed_at: null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: "status_change",
    from_status: current.status,
    to_status: status,
    // The trail records the milestone, not just the coarse status, so an audit
    // can see that a licence application passed inspection before it was
    // granted rather than only that the task was "waiting" twice.
    detail: next.label,
  });

  revalidatePath("/", "layout");
}

/**
 * Step one אבן דרך back, for a misclick.
 *
 * Without this the only way out of an accidental advance is the status picker,
 * which is what this feature replaced. Reverting is logged like any other
 * change: an audit trail that records only forward progress would misrepresent
 * what happened.
 */
export async function revertStage(taskId: string, fromStageId: string) {
  const { supabase } = await requireUser();

  const { data: current, error: readError } = await supabase
    .from("business_tasks")
    .select("id, business_id, template_id, status, stage")
    .eq("id", taskId)
    .single();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("task not found");

  const position = positionOf({
    template_id: current.template_id,
    stage: current.stage,
    status: current.status,
  });
  if (position.stage.id !== fromStageId) throw new Error("STALE_STAGE");
  if (position.index === 0) return;

  const prevIndex = position.index - 1;
  const prev = position.chain[prevIndex];
  const status = statusForStage(position.chain, prevIndex);

  const { error } = await supabase
    .from("business_tasks")
    .update({
      stage: prev.id,
      status,
      waiting_for: prev.owner === "them" ? prev.label : null,
      follow_up_date: checkBackDate(prev, todayInIsrael()),
      completed_at: null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: "status_change",
    from_status: current.status,
    to_status: status,
    detail: `חזרה ל: ${prev.label}`,
  });

  revalidatePath("/", "layout");
}

export async function setTaskStatus(
  taskId: string,
  status: Exclude<TaskStatus, "done">,
  extra?: {
    waitingFor?: string | null;
    followUpDate?: string | null;
    /**
     * Which kind of "doesn't apply" this is. Required in the UI for
     * not_relevant, because the two meanings have opposite consequences: one
     * gates a statutory duty, the other satisfies it. See lib/task-status.ts.
     */
    dismissal?: Dismissal | null;
    dismissalNote?: string | null;
  }
) {
  const { supabase } = await requireUser();

  const { data: current } = await supabase
    .from("business_tasks")
    .select("id, business_id, template_id, status")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  // Never trust the payload: a client could send any string, and this column
  // decides whether a statutory obligation is gated or asserted.
  const dismissal =
    status === "not_relevant" && isDismissal(extra?.dismissal) ? extra!.dismissal! : null;

  const { error } = await supabase
    .from("business_tasks")
    .update({
      status,
      completed_at: null,
      waiting_for: extra?.waitingFor ?? (status === "waiting" ? undefined : null),
      follow_up_date: extra?.followUpDate ?? (status === "waiting" ? undefined : null),
      // Setting a status by hand is now only reopening a task or dismissing
      // it. Either way the stored milestone is no longer trustworthy, so clear
      // it and let the task be placed by this status until the user advances it
      // again — a stale stage would claim a position nobody chose.
      stage: null,
      // Leaving not_relevant must clear the reason, or a re-opened task would
      // carry a stale dismissal that the DB check constraint also forbids.
      dismissal,
      dismissal_note: dismissal ? (extra?.dismissalNote?.trim().slice(0, 500) || null) : null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: current.status === "done" ? "reopened" : "status_change",
    from_status: current.status,
    to_status: status,
    // The trail records WHICH dismissal, not just that one happened — the
    // difference between "my accountant files this" and "not about me" is the
    // whole point of the split, and an audit has to be able to see it.
    detail: dismissal
      ? [DISMISSAL_LABEL[dismissal], extra?.dismissalNote?.trim()].filter(Boolean).join(" — ")
      : (extra?.waitingFor ?? null),
  });

  revalidatePath("/", "layout");
}

/**
 * Close a task. Requires the user to confirm the steps and supply evidence;
 * fields flagged `writesTo` also populate the business card.
 */
export async function completeTask(
  taskId: string,
  completionData: Record<string, string>,
  businessFields: Record<string, string>
) {
  const { supabase } = await requireUser();

  const { data: current } = await supabase
    .from("business_tasks")
    .select("id, business_id, template_id, status, completion_data, due_date")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  // Merge, never replace. completion_data carries evidence written by the
  // invoicing webhook, and a blind overwrite silently destroyed it with no way
  // to recover. Step progress used to live in here too, under a __steps_done
  // key, and was lost the same way; migration 025 moved it to its own column so
  // the two can no longer collide.
  const existing = (current.completion_data ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from("business_tasks")
    .update({
      status: "done",
      // Land on the terminal milestone, so the chain and the status agree. Without
      // this a finished task keeps the stage it was on — "ממתין לתעודת עוסק" —
      // and the tracker would show a completed task as still waiting.
      stage: terminalStageFor(current.template_id),
      completed_at: new Date().toISOString(),
      completion_data: { ...existing, ...completionData },
      waiting_for: null,
      follow_up_date: null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  // Evidence that belongs on the business card gets copied there — but ONLY the
  // columns this template declares via `writesTo`. Server Actions are a public
  // endpoint and TS types vanish at runtime, so the previous unfiltered splat
  // let any caller write arbitrary columns (subscription_tier included).
  const writable = new Set<string>(
    (TEMPLATES_BY_ID.get(current.template_id)?.completion?.fields ?? [])
      .map((f) => f.writesTo)
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
  );
  const cleaned = Object.fromEntries(
    Object.entries(businessFields).filter(
      ([k, v]) => writable.has(k) && typeof v === "string" && v.trim()
    )
  );
  if (Object.keys(cleaned).length > 0) {
    await supabase
      .from("businesses")
      .update(cleaned)
      .eq("id", current.business_id);
  }

  // RECORD WHICH PERIOD THIS FILING COVERED (migration 030).
  //
  // completion_data is overwritten every period, so without this the product
  // cannot say whether Jul–Aug was filed — and could therefore only ever report
  // a single missed period, however far behind the business actually was.
  //
  // The period comes from the deadline stored on the ROW, not from today's
  // date. A late filer is no longer standing in the period they are filing for,
  // so computing it from the calendar would file a late submission against the
  // wrong months.
  if (isStatutoryFiling(current.template_id) && current.due_date) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("onboarding_answers")
      .eq("id", current.business_id)
      .single();
    const answers = (biz?.onboarding_answers ?? {}) as { vat_frequency?: "monthly" | "bimonthly" };
    const period = periodForDue(current.due_date, answers.vat_frequency ?? "bimonthly");
    if (period) {
      // A second submission for the same period is a correction, not a new
      // filing — the unique key makes that the only representable outcome, and
      // the row keeps its identity rather than being deleted and re-added.
      const { error: filingError } = await supabase.from("task_filings").upsert(
        {
          business_id: current.business_id,
          template_id: current.template_id,
          period_key: period.key,
          due_date: period.dueIso,
          evidence: completionData,
        },
        { onConflict: "business_id,template_id,period_key" }
      );
      // Deliberately not fatal. The task IS completed at this point, and
      // failing the whole action over the filing ledger would make the user
      // re-do work they already did. It is reported in the event trail instead.
      if (filingError) {
        await supabase.from("task_events").insert({
          business_id: current.business_id,
          task_id: taskId,
          template_id: current.template_id,
          kind: "status_change",
          detail: `לא נרשמה תקופת הדיווח (${period.key}): ${filingError.message}`,
        });
      }
    }
  }

  const summary = Object.values(completionData).find((v) => v && v.trim()) ?? null;
  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: "completed",
    from_status: current.status,
    to_status: "done",
    detail: summary,
  });

  revalidatePath("/", "layout");
}

/**
 * Tick a real step of a task on or off.
 *
 * Progress lives in the typed `steps_done` column (migration 025). It used to
 * be a `__steps_done` key inside completion_data, which meant per-step
 * progress and completion evidence shared one untyped column — so the
 * whole-column write in completeTask destroyed both at once.
 */
export async function toggleTaskStep(taskId: string, stepIndex: number, done: boolean) {
  const { supabase } = await requireUser();
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    // The index arrives from a Server Action, which is a public POST endpoint,
    // and it is about to land in an int[] that renders index into a step list.
    throw new Error("invalid step index");
  }

  const { data: current, error: readError } = await supabase
    .from("business_tasks")
    .select("id, steps_done")
    .eq("id", taskId)
    .single();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("task not found");

  const set = new Set<number>(
    Array.isArray(current.steps_done) ? (current.steps_done as number[]) : []
  );
  if (done) set.add(stepIndex);
  else set.delete(stepIndex);

  const { error } = await supabase
    .from("business_tasks")
    .update({ steps_done: [...set].sort((a, b) => a - b) })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks", "layout");
}

/** Set or clear a personal deadline; logs it to the activity feed. */
export async function setTaskDueDate(taskId: string, dueDate: string | null) {
  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("business_tasks")
    .select("business_id, template_id")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  // Rejecting a malformed date here rather than letting Postgres decide: this
  // arrives from a Server Action, which is a public POST endpoint.
  if (dueDate !== null && !/^d{4}-d{2}-d{2}$/.test(dueDate)) {
    throw new Error("invalid date");
  }

  const { error } = await supabase
    .from("business_tasks")
    // personal_due_date, NOT due_date (migration 028). The reminder sweep owns
    // due_date and rolls it to the next statutory period, so a user's date
    // stored there would be erased by the next cron run without a trace.
    .update({ personal_due_date: dueDate })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: "deadline_set",
    detail: dueDate
      ? `דדליין אישי נקבע ל-${new Date(dueDate + "T00:00:00").toLocaleDateString("he-IL")}`
      : "הדדליין האישי הוסר",
  });
  revalidatePath("/", "layout");
}

// ---------- personal checklist inside a task ----------

export async function addChecklistItem(taskId: string, label: string) {
  const { supabase } = await requireUser();
  const text = label.trim();
  if (!text) return;
  const { data: task } = await supabase
    .from("business_tasks")
    .select("business_id")
    .eq("id", taskId)
    .single();
  if (!task) throw new Error("task not found");

  const { count } = await supabase
    .from("task_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("business_task_id", taskId);

  const { error } = await supabase.from("task_checklist_items").insert({
    business_id: task.business_id,
    business_task_id: taskId,
    label: text.slice(0, 300),
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/tasks", "layout");
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("task_checklist_items").update({ done }).eq("id", itemId);
  revalidatePath("/tasks", "layout");
}

export async function deleteChecklistItem(itemId: string) {
  const { supabase } = await requireUser();
  await supabase.from("task_checklist_items").delete().eq("id", itemId);
  revalidatePath("/tasks", "layout");
}

export async function saveTaskNotes(taskId: string, notes: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("business_tasks")
    .update({ notes })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks", "layout");
}

/** Update business-card fields (התיק הדיגיטלי). */
export async function updateBusinessCard(fields: {
  name?: string;
  dealer_number?: string;
  vat_file?: string;
  income_tax_file?: string;
  bituach_leumi_file?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account?: string;
  accountant_name?: string;
  accountant_phone?: string;
  accountant_email?: string;
}) {
  const { supabase, user } = await requireUser();
  // runtime allowlist — the typed signature above is erased at runtime
  const cleaned = Object.fromEntries(
    Object.entries(fields as Record<string, unknown>).filter(
      ([k, v]) => BUSINESS_CARD_FIELDS.has(k) && typeof v === "string"
    )
  );
  if (Object.keys(cleaned).length === 0) return { ok: true as const };
  const { error } = await supabase
    .from("businesses")
    .update(cleaned)
    .eq("owner_id", user.id);
  // Returned, not thrown: the caller is a form that has to tell the user their
  // tax-file and bank details did NOT save. A throw here became an unhandled
  // rejection in a transition and the user saw nothing.
  if (error) {
    console.error("updateBusinessCard failed", error.message);
    return { ok: false as const, error: "השמירה לא עברה. בדקו את החיבור ונסו שוב." };
  }
  revalidatePath("/business");
  return { ok: true as const };
}

export async function addDocument(doc: {
  category: string;
  name: string;
  storage_path: string;
  mime_type?: string;
  expires_at?: string | null;
  task_id?: string | null;
  checklist_item_id?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) throw new Error("business not found");

  const { error } = await supabase.from("documents").insert({
    ...doc,
    business_id: business.id, // after the spread: a client cannot override it
  });
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
  revalidatePath("/tasks", "layout");
}

export async function updateDocument(
  documentId: string,
  patch: { taskId?: string | null; category?: string }
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if ("taskId" in patch) update.task_id = patch.taskId;
  if (patch.category) update.category = patch.category;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
  revalidatePath("/tasks", "layout");
}

export async function deleteDocument(documentId: string) {
  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (doc) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
}

/** Set (or replace) the business logo after a client-side storage upload. */
export async function setBusinessLogo(storagePath: string) {
  const { supabase, user } = await requireUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, logo_path")
    .eq("owner_id", user.id)
    .single();
  if (!business) throw new Error("business not found");

  // best-effort cleanup of a previous logo
  if (business.logo_path && business.logo_path !== storagePath) {
    await supabase.storage.from("documents").remove([business.logo_path]);
  }

  const { error } = await supabase
    .from("businesses")
    .update({ logo_path: storagePath })
    .eq("id", business.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function addProduct(product: {
  name: string;
  description?: string;
  price?: number | null;
  unit: string;
}) {
  const { supabase, user } = await requireUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) throw new Error("business not found");

  const name = product.name.trim();
  if (!name) throw new Error("שם הפריט חסר");

  const { error } = await supabase.from("business_products").insert({
    business_id: business.id,
    name,
    description: product.description?.trim() || null,
    price: product.price ?? null,
    unit: product.unit,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteProduct(productId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("business_products")
    .delete()
    .eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function updateNotificationPrefs(prefs: {
  notify_email: boolean;
  notify_whatsapp: boolean;
  whatsapp_phone: string | null;
}) {
  const { supabase, user } = await requireUser();
  // explicit + coerced: never splat client input into a table
  const clean = {
    notify_email: Boolean(prefs?.notify_email),
    notify_whatsapp: Boolean(prefs?.notify_whatsapp),
    whatsapp_phone:
      typeof prefs?.whatsapp_phone === "string" && prefs.whatsapp_phone.trim()
        ? prefs.whatsapp_phone.trim().slice(0, 32)
        : null,
  };
  const { error } = await supabase
    .from("businesses")
    .update(clean)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function markNotificationRead(notificationId: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

/**
 * Starts a Pro trial (placeholder for real billing).
 *
 * NOTE: this grants Pro WITHOUT taking payment — it exists so the Guardian can
 * be built and demoed. Before launch, replace the body with a real checkout
 * (Stripe/Paddle) and only flip the flag on a verified `checkout.completed`
 * webhook. Never ship self-serve free Pro to production.
 */
/**
 * Starts a paid upgrade: creates a Stripe Checkout Session and hands back its
 * hosted URL for the client to navigate to.
 *
 * Note what this does NOT do: it does not touch subscription_tier. It cannot —
 * migration 019 rejects any session-level write to those columns, and the
 * verified webhook is the only writer. That is the whole point. The function it
 * replaced set subscription_tier = "pro" with no payment, recorded nothing, and
 * was re-callable indefinitely for rolling free Pro windows.
 *
 * Returns a friendly, honest message when billing is not yet configured rather
 * than sending the user into a broken flow.
 */
export async function startProCheckout(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const { supabase, user } = await requireUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, billing_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "לא נמצא עסק לחשבון הזה." };

  // Checkout sessions cost money to create in support time if abused, and this
  // is a logged-in but unmetered endpoint.
  const limit = await check(`checkout:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "נפתחו כבר כמה דפי תשלום. נסו שוב בעוד שעה." };
  }

  const headerBag = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (headerBag.get("origin") || `https://${headerBag.get("host") ?? "bizready.app"}`);

  const result = await createCheckoutSession({
    businessId: business.id,
    userId: user.id,
    email: user.email ?? null,
    origin,
    existingCustomerId:
      (business as { billing_customer_id?: string | null }).billing_customer_id ?? null,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, url: result.url };
}

export async function cancelPro() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("businesses")
    .update({ subscription_tier: "free", subscription_until: null })
    .eq("owner_id", user.id);
  revalidatePath("/", "layout");
}

// ---------- cost ledger ----------

async function requireBusinessId() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!data) redirect("/onboarding");
  return { supabase, businessId: data.id as string };
}

export async function addCost(input: {
  name: string;
  amount: number;
  cadence: string;
  templateId?: string | null;
  renewalDate?: string | null;
  note?: string | null;
}) {
  const { supabase, businessId } = await requireBusinessId();
  const { error } = await supabase.from("business_costs").insert({
    business_id: businessId,
    name: input.name,
    amount: input.amount,
    cadence: input.cadence,
    template_id: input.templateId ?? null,
    renewal_date: input.renewalDate ?? null,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteCost(costId: string) {
  const { supabase, businessId } = await requireBusinessId();
  await supabase.from("business_costs").delete().eq("id", costId).eq("business_id", businessId);
  revalidatePath("/", "layout");
}

// ============ manual income (money picture without an integration) ============

/**
 * Log revenue for a month by hand, so the finance intelligence — set-aside,
 * ceiling watch, revenue chart, next payments — works for everyone, not only
 * businesses that wired up an invoicing integration.
 *
 * Stored in sync_metrics under a distinct `manual_revenue` metric, so it never
 * collides with a provider's synced `revenue` and the two can be summed. Anchored
 * to the first of the month (the chart buckets by month). No migration needed.
 */
export async function setMonthlyIncome(
  monthKey: string, // "yyyy-mm"
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return { ok: false, error: "חודש לא תקין" };
  const value = Math.max(0, Math.round(Number(amount)));
  if (!Number.isFinite(value)) return { ok: false, error: "סכום לא תקין" };
  const { supabase, businessId } = await requireBusinessId();
  const { error } = await supabase.from("sync_metrics").upsert(
    {
      business_id: businessId,
      metric: "manual_revenue",
      metric_date: `${monthKey}-01`,
      value,
    },
    { onConflict: "business_id,metric_date,metric" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/insights");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ============ integrations ============

/** Connect a provider. API providers are credential-tested first. */
export async function createConnection(
  provider: string,
  creds: Record<string, string>,
  fieldMap: Record<string, boolean>
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, businessId } = await requireBusinessId();
  const adapter = PROVIDERS_BY_ID.get(provider);
  if (!adapter) return { ok: false, error: "ספק לא מוכר" };
  if (adapter.mode === "api" && adapter.testConnection) {
    const test = await adapter.testConnection(creds);
    if (!test.ok) return { ok: false, error: test.error ?? "החיבור נכשל — בדקו את המפתחות" };
  }
  // Credentials are sealed before they touch the database (AES-256-GCM, key in
  // CREDENTIALS_KEY). Fails closed: with no key configured we refuse the
  // connection rather than silently persisting a plaintext API key or password.
  let sealedCreds: Record<string, unknown> = {};
  if (adapter.mode === "api") {
    if (!sealingAvailable()) {
      return {
        ok: false,
        error: "הצפנת המפתחות אינה מוגדרת בשרת — לא נשמור מפתחות ללא הצפנה.",
      };
    }
    sealedCreds = seal(creds);
  }

  const { error } = await supabase.from("integration_connections").insert({
    business_id: businessId,
    provider: adapter.id,
    category: adapter.category,
    mode: adapter.mode,
    credentials: sealedCreds,
    field_map: fieldMap ?? {},
    // Every connection gets a signing secret: the webhook token only routes,
    // it cannot also authenticate (it is displayed and shared by design).
    webhook_secret: randomBytes(24).toString("hex"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/integrations");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Manual pull for an api connection — runs on the owner session (no service role). */
export async function syncConnectionNow(
  connectionId: string
): Promise<{ ok: boolean; error?: string; inserted?: number }> {
  const { supabase, businessId } = await requireBusinessId();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!conn) return { ok: false, error: "החיבור לא נמצא" };
  const adapter = PROVIDERS_BY_ID.get(conn.provider);
  if (!adapter?.pull) return { ok: false, error: "סנכרון ידני זמין לחיבורי API בלבד" };
  try {
    const since = conn.last_sync_at ? String(conn.last_sync_at).slice(0, 10) : null;
    const batch = await adapter.pull(
      open(conn.credentials),
      since,
      (conn.field_map ?? {}) as Record<string, boolean>
    );
    const res = await executeBatch(
      supabase,
      { id: conn.id, business_id: businessId, provider: conn.provider, label: adapter.label, category: conn.category },
      batch
    );
    revalidatePath("/integrations");
    revalidatePath("/", "layout");
    return { ok: true, inserted: res.inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : "הסנכרון נכשל";
    await supabase
      .from("integration_connections")
      .update({ status: "error", last_error: message })
      .eq("id", conn.id);
    return { ok: false, error: message };
  }
}

export async function disconnectConnection(connectionId: string) {
  const { supabase, businessId } = await requireBusinessId();
  await supabase
    .from("integration_connections")
    .update({ status: "disabled" })
    .eq("id", connectionId)
    .eq("business_id", businessId);
  revalidatePath("/integrations");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

// ============ partner marketplace ============

/** Public: a business/professional applies to be listed. No auth required. */
export async function submitPartnerApplication(input: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  serviceType: string;
  tier: "free" | "featured";
  website?: string;
  message?: string;
  /**
   * Honeypot. A real person never fills this in because it is not rendered
   * visibly; a script that fills every field in the form does.
   */
  confirmUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // A public, unauthenticated write. It had no rate limit, no length caps and
  // no bot trap, so anyone could flood the admin inbox and make us the
  // custodian of arbitrary third-party personal data.
  if (input.confirmUrl) {
    // Report success to the bot rather than telling it what tripped.
    return { ok: true };
  }

  const businessName = capLength(input.businessName, 120);
  const contactName = capLength(input.contactName, 120);
  const email = capLength(input.email, 254);
  if (!businessName || !contactName || !email || !input.serviceType) {
    return { ok: false, error: "נא למלא שם עסק, איש קשר, אימייל ותחום." };
  }
  // Shape check only — we are not the authority on what a deliverable address
  // is, but an entry with no @ is certainly not one.
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
    return { ok: false, error: "כתובת האימייל לא נראית תקינה." };
  }

  const headerBag = await headers();
  const ip =
    headerBag.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    headerBag.get("x-real-ip") ||
    "unknown";
  const limit = await check(`partner-application:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false,
      error: "נשלחו כבר כמה בקשות מהכתובת הזאת. נסו שוב בעוד שעה.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_applications").insert({
    business_name: businessName,
    contact_name: contactName,
    email,
    phone: capLength(input.phone, 40) || null,
    service_type: capLength(input.serviceType, 60),
    tier: input.tier === "featured" ? "featured" : "free",
    website: capLength(input.website, 300) || null,
    message: capLength(input.message, 2000) || null,
  });
  if (error) {
    console.error("submitPartnerApplication failed", error.message);
    return { ok: false, error: "השליחה נכשלה. נסו שוב." };
  }
  return { ok: true };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/home");
  return { supabase, user };
}

export async function setApplicationStatus(id: string, status: "new" | "approved" | "rejected") {
  const { supabase } = await requireAdmin();
  await supabase.from("partner_applications").update({ status }).eq("id", id);
  revalidatePath("/admin");
}

export async function setOfferActive(id: string, isActive: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("offers").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function createOffer(input: {
  title: string;
  description: string;
  ctaLabel: string;
  url?: string;
  couponCode?: string;
  templateId?: string;
  categoryId?: string;
  commissionType?: string;
  isFeatured: boolean;
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "כותרת חובה." };
  const { error } = await supabase.from("offers").insert({
    title,
    description: input.description?.trim() || "",
    cta_label: input.ctaLabel?.trim() || "לפרטים",
    url: input.url?.trim() || null,
    coupon_code: input.couponCode?.trim() || null,
    template_id: input.templateId?.trim() || null,
    category_id: input.categoryId?.trim() || null,
    commission_type: input.commissionType?.trim() || null,
    is_featured: input.isFeatured,
    is_active: input.isActive,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** In-app lead: the business asks a partner to reach out. Logs a billable lead
 *  with a snapshot of the business's own contact details. */
export async function requestOfferLead(
  offerId: string,
  note?: string
): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name, whatsapp_phone")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { ok: false };
  const { data: offer } = await supabase
    .from("offers")
    .select("title")
    .eq("id", offerId)
    .maybeSingle();
  const { error } = await supabase.from("partner_leads").insert({
    business_id: biz.id,
    offer_id: offerId,
    partner_hint: offer?.title ?? null,
    contact_name: biz.name,
    contact_email: user.email ?? null,
    contact_phone: biz.whatsapp_phone ?? null,
    note: note?.trim() || null,
  });
  return { ok: !error };
}

/**
 * Permanently delete the signed-in account and everything attached to it.
 *
 * The product ships a `critical`, statute-backed task about תיקון 13 that tells
 * the user to honour their own customers' right to erasure. Until now it had no
 * way to honour theirs: an exhaustive search found no delete path, no export
 * and no retention window anywhere in the codebase.
 *
 * Requires the user to type their email to confirm. That is not ceremony — this
 * removes uploaded tax returns and ID documents with no undo, and a Server
 * Action is a public POST endpoint, so a single stray request must not be able
 * to destroy an account.
 */
export async function deleteMyAccount(
  confirmation: string
): Promise<{ ok: false; error: string } | never> {
  const { user } = await requireUser();

  // Compare against the account's own email, case-insensitively. A mistyped
  // confirmation is a no-op, not a partial deletion.
  const expected = (user.email ?? "").trim().toLowerCase();
  if (!expected || confirmation.trim().toLowerCase() !== expected) {
    return { ok: false, error: "הכתובת לא תואמת לכתובת החשבון. המחיקה לא בוצעה." };
  }

  const report = await deleteAccountCompletely(user.id);
  if (!report.ok) {
    // Say what did not happen. Reporting a clean deletion we did not perform is
    // the exact failure mode this whole pass has been removing.
    console.error("account deletion incomplete", user.id, report.failures);
    return {
      ok: false,
      error:
        "המחיקה לא הושלמה במלואה ונרשמה לבדיקה. חלק מהנתונים עדיין קיימים — פנו אלינו כדי להשלים אותה.",
    };
  }

  redirect("/?deleted=1");
}

// ============================================================================
// Collaborators
//
// The accountant is the most important collaborator in Israeli compliance and
// the product had no way to admit one, so users shared their password. These
// actions are owner-only; the database enforces the same thing independently
// (migration 022), so a mistake here cannot become a data breach.
// ============================================================================

/** Owner-only gate. Returns the business or redirects. */
async function requireOwnedBusiness() {
  const { supabase, user } = await requireUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A collaborator has no business here. They reach this only by crafting a
  // request, and the RLS policy would reject the write anyway.
  if (!business) redirect("/home");
  return { supabase, user, business };
}

/**
 * Invites someone to collaborate.
 *
 * We invite an EMAIL, not a user: the accountant may not have an account yet,
 * and requiring them to sign up before being invited puts the chicken before
 * the egg. The token is what binds the invitation to the person who received
 * it, so it is single-use, unguessable, and never shown to anyone but the
 * invitee.
 */
export async function inviteMember(
  emailInput: string,
  role: MemberRole
): Promise<{ ok: true; inviteUrl: string } | { ok: false; error: string }> {
  const { supabase, user, business } = await requireOwnedBusiness();

  if (role !== "accountant" && role !== "viewer") {
    return { ok: false, error: "תפקיד לא מוכר." };
  }

  const email = normaliseEmail(emailInput);
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "כתובת האימייל לא נראית תקינה." };
  }
  if (email === normaliseEmail(user.email ?? "")) {
    return { ok: false, error: "זו הכתובת שלכם — אתם כבר בעלי העסק." };
  }

  // Inviting is a write to someone else's inbox. Meter it.
  const limit = await check(`invite:${user.id}`, 20, 24 * 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "שלחתם הרבה הזמנות היום. נסו שוב מחר." };
  }

  const inviteToken = randomBytes(24).toString("base64url");

  const { error } = await supabase.from("business_members").insert({
    business_id: business.id,
    invited_email: email,
    role,
    invited_by: user.id,
    invite_token: inviteToken,
  });

  if (error) {
    // 23505 = unique violation on the live-email index.
    if (error.code === "23505") {
      return { ok: false, error: "הכתובת הזאת כבר מוזמנת או משותפת לעסק." };
    }
    console.error("inviteMember failed", error.message);
    return { ok: false, error: "ההזמנה לא נשלחה. נסו שוב." };
  }

  revalidatePath("/settings");

  const headerBag = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (headerBag.get("origin") || `https://${headerBag.get("host") ?? "bizready.app"}`);

  // Returned to the owner to pass on. We do not send it ourselves yet — a
  // half-working mail path that silently drops invitations would be worse than
  // handing over a link the owner can see and verify.
  return { ok: true, inviteUrl: `${origin}/invite/${inviteToken}` };
}

/**
 * Revokes access. Keeps the row, so the history of who had access survives —
 * deleting it would erase the record along with the permission.
 */
export async function revokeMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, business } = await requireOwnedBusiness();
  const { error } = await supabase
    .from("business_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("business_id", business.id);
  if (error) {
    console.error("revokeMember failed", error.message);
    return { ok: false, error: "ההסרה נכשלה. נסו שוב." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Accepts an invitation, binding it to the signed-in user.
 *
 * The token is the credential. We deliberately do NOT require the signed-in
 * address to equal the invited one: an accountant may have been invited at
 * their firm address and sign in with a personal one, and refusing that would
 * strand the invitation with no way to fix it. The token was sent to the
 * invited address, so holding it is the proof.
 */
export async function acceptInvite(
  token: string
): Promise<{ ok: true; businessName: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  // Guessing a 192-bit token is not the threat; hammering the endpoint is.
  const limit = await check(`accept-invite:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return { ok: false, error: "יותר מדי נסיונות. נסו שוב מאוחר יותר." };

  const { data: invite } = await supabase
    .from("business_members")
    .select("id, business_id, accepted_at, revoked_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!invite) return { ok: false, error: "ההזמנה לא נמצאה או שפג תוקפה." };
  if (invite.revoked_at) return { ok: false, error: "ההזמנה בוטלה." };

  if (!invite.accepted_at) {
    const { error } = await supabase
      .from("business_members")
      .update({ user_id: user.id, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (error) {
      console.error("acceptInvite failed", error.message);
      return { ok: false, error: "לא הצלחנו לאשר את ההזמנה. נסו שוב." };
    }
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", invite.business_id)
    .maybeSingle();

  revalidatePath("/", "layout");
  return { ok: true, businessName: (business?.name as string) ?? "העסק" };
}

/**
 * Publishes a "a rule that affects you changed" notice.
 *
 * Admin-only, and deliberately a human act. The source watcher flags that a
 * page MOVED; deciding what that means — and whether it changed a deadline, an
 * amount or nothing at all — requires reading it. Auto-publishing this from a
 * checksum would be telling users the law changed on the strength of a diff.
 *
 * Writing it also acknowledges the source in one step, so the review queue and
 * the user-facing notice cannot drift apart.
 */
export async function publishContentChange(input: {
  templateId: string;
  summary: string;
  changeKind: "deadline" | "amount" | "rule" | "guidance";
  sourceUrl: string;
  effectiveFrom?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();

  // The template must exist in the shipped content, or the notice would name a
  // task no user has and render as a message about nothing.
  if (!TEMPLATES_BY_ID.has(input.templateId)) {
    return { ok: false, error: "לא קיימת משימה עם המזהה הזה." };
  }
  const summary = capLength(input.summary, 400);
  if (!summary) return { ok: false, error: "צריך לכתוב מה השתנה." };
  if (!/^https:\/\//.test(input.sourceUrl)) {
    return { ok: false, error: "צריך קישור למקור הרשמי." };
  }

  const { error } = await supabase.from("content_changelog").insert({
    template_id: input.templateId,
    summary,
    change_kind: input.changeKind,
    source_url: input.sourceUrl,
    effective_from: input.effectiveFrom || null,
  });
  if (error) {
    console.error("publishContentChange failed", error.message);
    return { ok: false, error: "הפרסום נכשל. נסו שוב." };
  }

  // Same source is now reviewed — clear it from the moved-sources list so the
  // team is not asked to look at it twice.
  await supabase
    .from("source_fingerprints")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("url", input.sourceUrl);

  revalidatePath("/", "layout");
  return { ok: true };
}
