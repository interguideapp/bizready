import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { todayInIsrael } from "@/lib/dates";
import { SYNCED_DATA_RETENTION_DAYS, retentionCutoff } from "@/lib/privacy";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retention sweep: removes ingested customer data past its window.
 *
 * `synced_documents.customer_name` and `synced_contacts.name` are the user's OWN
 * customers' personal data, pulled in by default because registry.ts marks those
 * fields `default: true`. They had no TTL and, until migration 017, no DELETE
 * policy either — so the product accumulated third-party personal data
 * indefinitely while telling the user, in a critical statute-backed task, to
 * honour their customers' right to erasure.
 *
 * This is the job that makes the retention policy real rather than a sentence in
 * a comment. It runs with the service role, so it fails closed without
 * CRON_SECRET like every other cron route here.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayInIsrael();
  const cutoff = retentionCutoff(today);

  const removed: Record<string, number> = {};
  const failures: string[] = [];

  /**
   * Each table declares which column dates it. synced_orders has no date of its
   * own beyond created_at, and metrics are aggregates rather than personal data,
   * so they are swept on created_at too.
   */
  const SWEEPS: { table: string; dateColumn: string }[] = [
    { table: "synced_documents", dateColumn: "issued_at" },
    { table: "synced_contacts", dateColumn: "created_at" },
    { table: "synced_orders", dateColumn: "created_at" },
  ];

  for (const { table, dateColumn } of SWEEPS) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .lt(dateColumn, cutoff)
      .select("id");

    if (error) {
      // Reported, not swallowed. A retention sweep that silently fails is worse
      // than none, because the policy is then a claim with nothing behind it.
      console.error(`retention sweep failed for ${table}`, error.message);
      failures.push(`${table}: ${error.message}`);
      continue;
    }
    removed[table] = data?.length ?? 0;
  }

  // reminder_log exists purely to dedupe sends; it has no reason to outlive the
  // periods it covers, and it grows once per business per reminder per day.
  const { error: logError } = await supabase
    .from("reminder_log")
    .delete()
    .lt("sent_at", cutoff);
  if (logError) failures.push(`reminder_log: ${logError.message}`);

  return NextResponse.json({
    ok: failures.length === 0,
    today,
    cutoff,
    retentionDays: SYNCED_DATA_RETENTION_DAYS,
    removed,
    failures,
  });
}
