"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TASK_TEMPLATES } from "@/lib/content";
import { buildPlan, profileFromAnswers, reconcilePlan } from "@/lib/rules-engine";
import { nextStatutoryDueDate, STATUTORY_FILINGS } from "@/lib/compliance";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers, TaskStatus } from "@/lib/types";

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
  businessName: string,
  answers: OnboardingAnswers
) {
  const { supabase, user } = await requireUser();

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
        started_at: new Date().toISOString().slice(0, 10),
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

/** Update answers from settings and reconcile the task list. */
export async function updateAnswers(answers: OnboardingAnswers) {
  const { supabase, user } = await requireUser();

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

  const { toAdd, toFlagIrrelevant, toFlagRelevant } = reconcilePlan(
    answers,
    TASK_TEMPLATES,
    existing ?? []
  );

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
}

/**
 * Move a task between the non-done statuses. Completing a task goes through
 * `completeTask` instead — it requires evidence.
 */
export async function setTaskStatus(
  taskId: string,
  status: Exclude<TaskStatus, "done">,
  extra?: { waitingFor?: string | null; followUpDate?: string | null }
) {
  const { supabase } = await requireUser();

  const { data: current } = await supabase
    .from("business_tasks")
    .select("id, business_id, template_id, status")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  const { error } = await supabase
    .from("business_tasks")
    .update({
      status,
      completed_at: null,
      waiting_for: extra?.waitingFor ?? (status === "waiting" ? undefined : null),
      follow_up_date: extra?.followUpDate ?? (status === "waiting" ? undefined : null),
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
    detail: extra?.waitingFor ?? null,
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
    .select("id, business_id, template_id, status")
    .eq("id", taskId)
    .single();
  if (!current) throw new Error("task not found");

  const { error } = await supabase
    .from("business_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completion_data: completionData,
      waiting_for: null,
      follow_up_date: null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  // evidence that belongs on the business card gets copied there
  const cleaned = Object.fromEntries(
    Object.entries(businessFields).filter(([, v]) => v && v.trim())
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
  const { error } = await supabase
    .from("businesses")
    .update(fields)
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
    business_id: business.id,
    ...doc,
  });
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
  const { error } = await supabase
    .from("businesses")
    .update(prefs)
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
export async function startProTrial() {
  const { supabase, user } = await requireUser();
  const until = new Date();
  until.setDate(until.getDate() + 14);
  const { error } = await supabase
    .from("businesses")
    .update({ subscription_tier: "pro", subscription_until: until.toISOString() })
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
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

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
