import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Account deletion and data export — the rights the product teaches and, until
 * now, did not implement.
 *
 * BizReady ships a `critical`, statute-backed task titled
 * "מדיניות פרטיות תואמת תיקון 13" that instructs the user to tell THEIR
 * customers about rights of access, correction and erasure. An exhaustive
 * search of this codebase found no delete-account path, no export, and no
 * retention window anywhere. Meanwhile `synced_documents.customer_name` and
 * `synced_contacts.name` — the user's OWN customers' personal data, ingested by
 * default because `registry.ts` marks those fields `default: true` — had no
 * DELETE policy at all and no TTL.
 *
 * So the product was asking a business owner to be a responsible data
 * controller while giving them no way to be one. That is the credibility gap
 * this module closes.
 *
 * Two hard requirements shaped the implementation:
 *
 * 1. Deletion must reach Storage. The DB cascades from `auth.users`, but
 *    uploaded tax returns and ID scans live in a Storage bucket under
 *    `${user.id}/`, which no cascade touches. A "deleted" account that leaves
 *    someone's ID document sitting in object storage has not been deleted.
 *
 * 2. Deletion must be verifiable. Each step reports what it removed, and a
 *    partial failure is reported as a partial failure rather than swallowed —
 *    the same rule the rest of this codebase now follows.
 */

export interface DeletionReport {
  ok: boolean;
  storageObjectsRemoved: number;
  pushSubscriptionsRemoved: number;
  /** Anything that did not complete. Non-empty means the deletion is partial. */
  failures: string[];
}

/**
 * Everything the export contains. Deliberately the user's own data plus the
 * customer data they are the controller of — an export that omitted the latter
 * would not let them answer their own customers' access requests.
 */
export interface DataExport {
  exportedAt: string;
  account: { userId: string; email: string | null };
  business: Record<string, unknown> | null;
  tasks: Record<string, unknown>[];
  taskEvents: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  checklistItems: Record<string, unknown>[];
  products: Record<string, unknown>[];
  costs: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  integrations: Record<string, unknown>[];
  /** The user's customers' data that we ingested. They are the controller. */
  syncedDocuments: Record<string, unknown>[];
  syncedContacts: Record<string, unknown>[];
  syncedOrders: Record<string, unknown>[];
  syncMetrics: Record<string, unknown>[];
}

/** Tables that belong to a business and are exported/deleted with it. */
const BUSINESS_TABLES = [
  "business_tasks",
  "task_events",
  "documents",
  "task_checklist_items",
  "business_products",
  "business_costs",
  "notifications",
  "integration_connections",
  "synced_documents",
  "synced_contacts",
  "synced_orders",
  "sync_metrics",
] as const;

/**
 * Collects everything we hold for a user, as plain JSON.
 *
 * Uses the caller's own authenticated client rather than the service role: an
 * export is a read of your own data, and routing it through RLS means the
 * export cannot accidentally reach across tenants even if this function is
 * called with the wrong id.
 */
export async function buildDataExport(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  },
  args: { userId: string; email: string | null; businessId: string | null }
): Promise<DataExport> {
  const empty: Record<string, unknown>[] = [];
  const read = async (table: string, column: string, value: string) => {
    const { data } = await supabase.from(table).select("*").eq(column, value);
    return (data as Record<string, unknown>[] | null) ?? empty;
  };

  const business = args.businessId
    ? ((await read("businesses", "id", args.businessId))[0] ?? null)
    : null;

  const byBusiness: Record<string, Record<string, unknown>[]> = {};
  if (args.businessId) {
    for (const table of BUSINESS_TABLES) {
      byBusiness[table] = await read(table, "business_id", args.businessId);
    }
  }

  // Credentials are sealed at rest and must not be decrypted into an export —
  // the user already holds those secrets with the provider, and putting them in
  // a downloadable file recreates exactly the exposure encryption removed.
  const integrations = (byBusiness["integration_connections"] ?? []).map((row) => {
    const { credentials, webhook_secret, webhook_token, ...safe } = row;
    void credentials;
    void webhook_secret;
    void webhook_token;
    return { ...safe, credentials: "[redacted — held encrypted, not exported]" };
  });

  return {
    exportedAt: new Date().toISOString(),
    account: { userId: args.userId, email: args.email },
    business,
    tasks: byBusiness["business_tasks"] ?? empty,
    taskEvents: byBusiness["task_events"] ?? empty,
    documents: byBusiness["documents"] ?? empty,
    checklistItems: byBusiness["task_checklist_items"] ?? empty,
    products: byBusiness["business_products"] ?? empty,
    costs: byBusiness["business_costs"] ?? empty,
    notifications: byBusiness["notifications"] ?? empty,
    integrations,
    syncedDocuments: byBusiness["synced_documents"] ?? empty,
    syncedContacts: byBusiness["synced_contacts"] ?? empty,
    syncedOrders: byBusiness["synced_orders"] ?? empty,
    syncMetrics: byBusiness["sync_metrics"] ?? empty,
  };
}

/**
 * Permanently removes an account: Storage objects, push subscriptions, then the
 * auth user (which cascades every table via profiles -> businesses).
 *
 * Storage goes FIRST and deliberately. Once the auth user is gone we no longer
 * know which prefix belonged to them, so a failure after that point would leave
 * orphaned tax returns and ID scans in the bucket with nothing pointing at them.
 * Deleting files for an account that still exists is recoverable; losing the
 * pointer to files that still exist is not.
 */
export async function deleteAccountCompletely(userId: string): Promise<DeletionReport> {
  const admin = createAdminClient();
  const failures: string[] = [];
  let storageObjectsRemoved = 0;
  let pushSubscriptionsRemoved = 0;

  // ---- 1. Storage, under the per-user prefix ----
  try {
    const { data: files, error } = await admin.storage.from("documents").list(userId, {
      limit: 1000,
    });
    if (error) {
      failures.push(`storage list: ${error.message}`);
    } else if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: rmError } = await admin.storage.from("documents").remove(paths);
      if (rmError) failures.push(`storage remove: ${rmError.message}`);
      else storageObjectsRemoved = paths.length;
      // A full page means there may be more than the limit; say so rather than
      // reporting a clean deletion we did not perform.
      if (files.length === 1000) {
        failures.push(
          "storage: hit the 1000-object page limit — re-run deletion to clear the remainder"
        );
      }
    }
  } catch (err) {
    failures.push(`storage: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- 2. Push subscriptions (keyed by user, not by business) ----
  try {
    const { data, error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (error) failures.push(`push_subscriptions: ${error.message}`);
    else pushSubscriptionsRemoved = data?.length ?? 0;
  } catch (err) {
    failures.push(`push_subscriptions: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- 3. The auth user; profiles -> businesses -> everything cascades ----
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) failures.push(`auth user: ${error.message}`);
  } catch (err) {
    failures.push(`auth user: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok: failures.length === 0,
    storageObjectsRemoved,
    pushSubscriptionsRemoved,
    failures,
  };
}

/**
 * How long ingested customer data is kept. This is the retention window the
 * product had none of.
 *
 * 18 months is chosen to comfortably cover the longest reporting cycle the app
 * reasons about — an annual return filed by 30 April for the previous year, plus
 * room for a late filing — so the data outlives its purpose but not by years.
 */
export const SYNCED_DATA_RETENTION_DAYS = 548;

/** The cutoff date for the retention sweep, as an ISO date. */
export function retentionCutoff(todayIso: string, days = SYNCED_DATA_RETENTION_DAYS): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - days * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Shows only the last four digits of an account number.
 *
 * Used on the passport — the document the product tells the user to hand to a
 * bank, an accountant or a client. A full account number on an artifact
 * designed to be shared, and printed to a PDF that then lives in someone's
 * downloads folder, is the one field that should not be there by default. The
 * business card still shows it in full, because that is the user's own private
 * reference, and so does their data export.
 */
export function maskAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Too short to mask meaningfully — showing "••1" reveals as much as it hides,
  // so return it as-is rather than pretending.
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}
