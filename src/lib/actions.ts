"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TASK_TEMPLATES } from "@/lib/content";
import { buildPlan, reconcilePlan } from "@/lib/rules-engine";
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

  revalidatePath("/", "layout");
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("business_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
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

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
