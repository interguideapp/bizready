import { redirect } from "next/navigation";
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
  subscription_tier: string;
  subscription_until: string | null;
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
  checklist_item_id: string | null;
  category: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Thrown when a read the compliance answer depends on fails.
 *
 * These reads used to discard their error and return an empty result. Every
 * screen renders "empty" as "you are all clear" — so a Supabase outage, an RLS
 * regression or a missing migration produced a confident, false clean bill of
 * health. That is the most dangerous lie this product can tell, so they now
 * fail loudly and the (app) error boundary says "we cannot verify your status".
 */
export class DataUnavailableError extends Error {
  constructor(what: string, cause?: string) {
    super("לא הצלחנו לטעון " + what);
    this.name = "DataUnavailableError";
    if (cause) this.cause = cause;
  }
}

type DbError = { message: string } | null;

/** A read the compliance answer depends on: fail loudly, never fake an empty. */
function critical<T>(what: string, data: T | null, error: DbError): T | null {
  if (error) throw new DataUnavailableError(what, error.message);
  return data;
}

/** Genuinely optional data: degrade to a fallback, but never silently. */
function optional<T>(what: string, data: T | null, error: DbError, fallback: T): T {
  if (error) {
    console.error("[data] optional read failed (" + what + "): " + error.message);
    return fallback;
  }
  return data ?? fallback;
}

/** Current user's business, or null if onboarding hasn't been completed. */
export async function getBusiness(): Promise<BusinessRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  return critical("את פרטי העסק", data, error) as BusinessRow | null;
}

/**
 * The business for the current request, guaranteed non-null.
 *
 * The (app) layout already redirects when onboarding is incomplete; this makes
 * that guarantee explicit instead of relying on a non-null assertion repeated
 * across a dozen pages (each of which used to hard-500 if the row was missing).
 */
export async function requireBusiness(): Promise<BusinessRow> {
  const business = await getBusiness();
  if (!business) redirect("/onboarding");
  return business;
}

export async function getBusinessTasks(
  businessId: string
): Promise<BusinessTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_tasks")
    .select(
      "id, business_id, template_id, status, due_date, completed_at, notes, is_relevant, dismissal, dismissal_note, completion_data, follow_up_date, waiting_for"
    )
    .eq("business_id", businessId);
  return (critical("את המשימות", data, error) ?? []) as BusinessTask[];
}

/** Newest first. Capped, because the archive grows without bound otherwise. */
export const DOCUMENTS_PAGE_SIZE = 200;

export async function getDocuments(
  businessId: string,
  limit = DOCUMENTS_PAGE_SIZE
): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    // Fetch one extra so the caller can tell "exactly the limit" from "more
    // than the limit" and say so, instead of silently truncating.
    .limit(limit + 1);
  return (critical("את המסמכים", data, error) ?? []) as DocumentRow[];
}

export interface ChecklistItemRow {
  id: string;
  label: string;
  done: boolean;
  sort_order: number;
}

export async function getChecklistItems(
  businessTaskId: string
): Promise<ChecklistItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, label, done, sort_order")
    .eq("business_task_id", businessTaskId)
    .order("sort_order")
    .order("created_at");
  return (critical("את הצעדים", data, error) ?? []) as ChecklistItemRow[];
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
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (critical("את ההתראות", data, error) ?? []) as NotificationRow[];
}

export async function getUnreadCount(businessId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("read_at", null);
  return optional("מונה ההתראות", count, error, 0);
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
  is_featured?: boolean;
  is_active?: boolean;
  sort_order: number;
}

const OFFER_COLS =
  "id, template_id, category_id, title, description, cta_label, url, coupon_code, commission_type, is_featured, is_active, sort_order";

/** Offers attached to a specific task template (shown inside the task screen).
 *  Featured (paid) offers surface first. */
export async function getOffersForTemplate(
  templateId: string
): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select(OFFER_COLS)
    .eq("is_active", true)
    .eq("template_id", templateId)
    .order("is_featured", { ascending: false })
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
  const { data, error } = await supabase
    .from("task_events")
    .select("id, template_id, kind, from_status, to_status, detail, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (critical("את יומן הפעילות", data, error) ?? []) as TaskEventRow[];
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

// ---------- cost ledger ----------
import type { CostRow } from "@/lib/costs";

/** Resilient: returns [] if the business_costs table isn't there yet. */
export async function getCosts(businessId: string): Promise<CostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_costs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return optional("את העלויות", data, error, []) as CostRow[];
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
  const { data, error } = await supabase
    .from("sync_metrics")
    .select("metric_date, metric, value")
    .eq("business_id", businessId)
    .gte("metric_date", sinceIso)
    .order("metric_date");
  return ((critical("את נתוני ההכנסות", data, error) ?? []) as MetricRow[]).map((m) => ({
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

/** All active offers (for the Shop), featured first. */
export async function getActiveOffers(): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select(OFFER_COLS)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("sort_order");
  return (data ?? []) as OfferRow[];
}

// ============ admin / marketplace management ============

/** Is the current signed-in user on the admin allowlist? */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

export interface PartnerApplicationRow {
  id: string;
  created_at: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  service_type: string;
  tier: string;
  website: string | null;
  message: string | null;
  status: string;
}

/** All partner applications (admin only — RLS enforces). */
export async function getPartnerApplications(): Promise<PartnerApplicationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_applications")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PartnerApplicationRow[];
}

export interface PartnerLeadRow {
  id: string;
  created_at: string;
  offer_id: string | null;
  partner_hint: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  status: string;
}

/** All in-app partner leads (admin only — RLS enforces), newest first. */
export async function getPartnerLeads(): Promise<PartnerLeadRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_leads")
    .select("id, created_at, offer_id, partner_hint, contact_name, contact_email, contact_phone, note, status")
    .order("created_at", { ascending: false });
  return (data ?? []) as PartnerLeadRow[];
}

/** Every offer regardless of active state (admin management view). */
export async function getAllOffers(): Promise<OfferRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select(OFFER_COLS)
    .order("is_active", { ascending: false })
    .order("sort_order");
  return (data ?? []) as OfferRow[];
}
