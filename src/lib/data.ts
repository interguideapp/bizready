import { createClient } from "@/lib/supabase/server";
import type { BusinessTask, OnboardingAnswers } from "@/lib/types";

export interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  entity_type: string;
  field: string | null;
  started_at: string | null;
  onboarding_answers: OnboardingAnswers | Record<string, never>;
  onboarding_completed_at: string | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_push: boolean;
  whatsapp_phone: string | null;
  logo_path: string | null;
  dealer_number: string | null;
  vat_file: string | null;
  income_tax_file: string | null;
  bituach_leumi_file: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account: string | null;
  accountant_name: string | null;
  accountant_phone: string | null;
  accountant_email: string | null;
}

export interface DocumentRow {
  id: string;
  business_id: string;
  task_id: string | null;
  category: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  expires_at: string | null;
  created_at: string;
}

/** Current user's business, or null if onboarding hasn't been completed. */
export async function getBusiness(): Promise<BusinessRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  return data as BusinessRow | null;
}

export async function getBusinessTasks(
  businessId: string
): Promise<BusinessTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_tasks")
    .select(
      "id, business_id, template_id, status, due_date, completed_at, notes, is_relevant, completion_data, follow_up_date, waiting_for"
    )
    .eq("business_id", businessId);
  return (data ?? []) as BusinessTask[];
}

export async function getDocuments(businessId: string): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocumentRow[];
}

export interface NotificationRow {
  id: string;
  business_id: string;
  type: string;
  title: string;
  body: string | null;
  template_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function getNotifications(
  businessId: string
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadCount(businessId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null);
  return count ?? 0;
}

export interface OfferRow {
  id: string;
  template_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  cta_label: string;
  url: string | null;
  coupon_code: string | null;
  commission_type: string | null;
  sort_order: number;
}

/** Offers attached to a specific task template (shown inside the task screen). */
export async function getOffersForTemplate(
  templateId: string
): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select("id, template_id, category_id, title, description, cta_label, url, coupon_code, commission_type, sort_order")
    .eq("is_active", true)
    .eq("template_id", templateId)
    .order("sort_order");
  return (data ?? []) as OfferRow[];
}

export interface TaskEventRow {
  id: string;
  template_id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  detail: string | null;
  created_at: string;
}

export async function getTaskEvents(
  businessId: string,
  limit = 40
): Promise<TaskEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_events")
    .select("id, template_id, kind, from_status, to_status, detail, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TaskEventRow[];
}

export interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  unit: string;
  sort_order: number;
}

export async function getProducts(businessId: string): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_products")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as ProductRow[];
}

// ---------- integrations ----------

export interface ConnectionListRow {
  id: string;
  provider: string;
  category: string;
  mode: string;
  webhook_token: string;
  webhook_secret: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export async function getConnections(
  businessId: string
): Promise<ConnectionListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select(
      "id, provider, category, mode, webhook_token, webhook_secret, status, last_sync_at, last_error"
    )
    .eq("business_id", businessId)
    .order("created_at");
  return (data ?? []) as ConnectionListRow[];
}

export interface MetricRow {
  metric_date: string;
  metric: string;
  value: number;
}

export async function getMetrics(
  businessId: string,
  sinceIso: string
): Promise<MetricRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_metrics")
    .select("metric_date, metric, value")
    .eq("business_id", businessId)
    .gte("metric_date", sinceIso)
    .order("metric_date");
  return ((data ?? []) as MetricRow[]).map((m) => ({
    ...m,
    value: Number(m.value),
  }));
}

export interface TopCustomerRow {
  customer_name: string;
  total: number;
  count: number;
}

export async function getTopCustomers(
  businessId: string,
  limit = 5
): Promise<TopCustomerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("synced_documents")
    .select("customer_name, amount, kind")
    .eq("business_id", businessId)
    .not("customer_name", "is", null);
  const byName = new Map<string, { total: number; count: number }>();
  for (const doc of data ?? []) {
    if (doc.kind === "quote") continue;
    const sign = doc.kind === "credit" ? -1 : 1;
    const entry = byName.get(doc.customer_name) ?? { total: 0, count: 0 };
    entry.total += sign * Number(doc.amount);
    entry.count += 1;
    byName.set(doc.customer_name, entry);
  }
  return [...byName.entries()]
    .map(([customer_name, v]) => ({ customer_name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface LeadFunnelRow {
  stage: string;
  count: number;
}

export async function getLeadFunnel(businessId: string): Promise<LeadFunnelRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("synced_contacts")
    .select("stage")
    .eq("business_id", businessId);
  const byStage = new Map<string, number>();
  for (const row of data ?? []) {
    byStage.set(row.stage, (byStage.get(row.stage) ?? 0) + 1);
  }
  return [...byStage.entries()].map(([stage, count]) => ({ stage, count }));
}

export interface SyncErrorRow {
  id: string;
  code: string;
  message: string;
  hint: string | null;
  occurred_at: string;
}

export async function getOpenSyncErrors(
  businessId: string
): Promise<SyncErrorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_errors")
    .select("id, code, message, hint, occurred_at")
    .eq("business_id", businessId)
    .is("resolved_at", null)
    .order("occurred_at", { ascending: false })
    .limit(20);
  return (data ?? []) as SyncErrorRow[];
}

/** All active offers (for the Shop), newest-relevant first. */
export async function getActiveOffers(): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select("id, template_id, category_id, title, description, cta_label, url, coupon_code, commission_type, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as OfferRow[];
}
