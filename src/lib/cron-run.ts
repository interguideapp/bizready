import type { SupabaseClient } from "@supabase/supabase-js";
import type { SweepJob } from "@/lib/heartbeat";

/**
 * Record that a scheduled job ran, so its silence can be noticed.
 *
 * Two calls rather than a wrapper, because the routes already have several
 * early returns each and threading them through a callback would mean
 * restructuring working code that sends real email to real tenants.
 *
 * A row that is opened and never closed is not a defect here — it is the
 * signal for "started and crashed". `sweep_health()` reads the newest run with
 * `ok is true`, so an unfinished row correctly counts as "has not run
 * successfully" rather than being mistaken for a success.
 *
 * THE RULE: the heartbeat never changes the outcome of the work. Every failure
 * in here is swallowed, because a monitoring table must not be able to take
 * down the thing it monitors.
 */

export interface CronRunHandle {
  id: string | null;
}

export async function beginCronRun(
  supabase: SupabaseClient,
  job: SweepJob
): Promise<CronRunHandle> {
  try {
    const { data } = await supabase
      .from("cron_runs")
      .insert({ job, started_at: new Date().toISOString() })
      .select("id")
      .single();
    return { id: (data?.id as string) ?? null };
  } catch {
    return { id: null };
  }
}

export async function endCronRun(
  supabase: SupabaseClient,
  handle: CronRunHandle,
  ok: boolean,
  detail?: unknown
): Promise<void> {
  if (!handle.id) return;
  try {
    await supabase
      .from("cron_runs")
      .update({
        finished_at: new Date().toISOString(),
        ok,
        detail: detail === undefined ? null : safeDetail(detail),
      })
      .eq("id", handle.id);
  } catch {
    // Same rule. The job's result is what matters.
  }
}

/**
 * Keep only what is safely storable.
 *
 * `detail` is read by an admin debugging a failure, not by the product. These
 * summaries are whatever a route decided to return, so cap and round-trip them
 * rather than assuming they are small and JSON-safe.
 */
function safeDetail(result: unknown): unknown {
  try {
    const json = JSON.stringify(result);
    if (json === undefined) return null;
    if (json.length <= 4000) return JSON.parse(json);
    return { truncated: true, preview: json.slice(0, 4000) };
  } catch {
    return { unserialisable: true };
  }
}
