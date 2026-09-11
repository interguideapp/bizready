"use server";
import { randomBytes } from "node:crypto";
import { seal, open, sealingAvailable } from "@/lib/crypto-box";
import { sanitizeAnswers, sanitizeBusinessName } from "@/lib/validate-answers";

import { todayInIsrael } from "@/lib/dates";
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
import { nextStatutoryDueDate, STATUTORY_FILINGS } from "@/lib/compliance";
import { createClient } from "@/lib/supabase/server";
import { DISMISSAL_LABEL, isDismissal, type Dismissal } from "@/lib/task-status";
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
    .select("id, business_id, template_id, status, completion_data")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  // Merge, never replace. completion_data also carries per-step progress
  // (__steps_done) and evidence written by the invoicing webhook; a blind
  // overwrite silently destroyed both, with no way to recover them.
  const existing = (current.completion_data ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from("business_tasks")
    .update({
      status: "done",
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
 * Tick a real step of a task on or off. Progress is stored as the completed step
 * indices under `__steps_done` in the task's completion_data (jsonb) — no schema
 * change — so each task tracks how far along its real-world steps you are.
 */
export async function toggleTaskStep(taskId: string, stepIndex: number, done: boolean) {
  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("business_tasks")
    .select("id, completion_data")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");
  const data = (current.completion_data ?? {}) as Record<string, unknown>;
  const set = new Set<number>(
    Array.isArray(data.__steps_done) ? (data.__steps_done as number[]) : []
  );
  if (done) set.add(stepIndex);
  else set.delete(stepIndex);
  const next = { ...data, __steps_done: [...set].sort((a, b) => a - b) };
  const { error } = await supabase
    .from("business_tasks")
    .update({ completion_data: next })
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

  const { error } = await supabase
    .from("business_tasks")
    .update({ due_date: dueDate })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_events").insert({
    business_id: current.business_id,
    task_id: taskId,
    template_id: current.template_id,
    kind: "deadline_set",
    detail: dueDate
      ? `דדליין נקבע ל-${new Date(dueDate + "T00:00:00").toLocaleDateString("he-IL")}`
      : "הדדליין הוסר",
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
  if (Object.keys(cleaned).length === 0) return;
  const { error } = await supabase
    .from("businesses")
    .update(cleaned)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/business");
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
export async function startProTrial(): Promise<{ ok: false; error: string }> {
  // Deliberately inert. This used to set subscription_tier = "pro" with no
  // payment, no trial-already-used check, and was re-callable indefinitely for
  // rolling free windows — its own docstring said never to ship it.
  //
  // Subscription state is now written in exactly one place: the verified Stripe
  // checkout webhook (service role). No client-reachable path may grant Pro.
  return { ok: false, error: "השדרוג ל-Pro ייפתח בקרוב" };
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
}): Promise<{ ok: boolean; error?: string }> {
  const businessName = input.businessName?.trim();
  const contactName = input.contactName?.trim();
  const email = input.email?.trim();
  if (!businessName || !contactName || !email || !input.serviceType) {
    return { ok: false, error: "נא למלא שם עסק, איש קשר, אימייל ותחום." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("partner_applications").insert({
    business_name: businessName,
    contact_name: contactName,
    email,
    phone: input.phone?.trim() || null,
    service_type: input.serviceType,
    tier: input.tier === "featured" ? "featured" : "free",
    website: input.website?.trim() || null,
    message: input.message?.trim() || null,
  });
  if (error) return { ok: false, error: "השליחה נכשלה. נסו שוב." };
  return { ok: true };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/dashboard");
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
