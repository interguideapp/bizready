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
 * WHAT THAT COST, and why beginCronRun now closes abandoned rows. Silence and
 * failure are not the same news. sweep_health reports last_failed_at only from
 * rows with `ok is false`, and a crash writes neither — so a job crashing on
 * every single invocation looked exactly like a job that was merely quiet, and
 * the user was told reminders were not going out only once the gap reached
 * "stale", 36 hours later. Closing the abandoned row makes `failing` true on
 * the next attempt, which is a day earlier.
 *
 * Only rows older than ABANDONED_AFTER_MS are touched. An open row can also
 * mean "a run is in progress", and marking a live run as failed would make the
 * flag lie in the other direction; nothing on this plan can still be running
 * after 60 seconds, so five minutes is past any doubt.
 *
 * THE RULE: the heartbeat never changes the outcome of the work. Every failure
 * in here is swallowed, because a monitoring table must not be able to take
 * down the thing it monitors.
 */

export interface CronRunHandle {
  id: string | null;
}

/**
 * How long an unfinished row must sit before it is certainly abandoned.
 *
 * The dispatcher declares maxDuration 60 (Hobby's ceiling), so no invocation
 * can still be alive after a minute. Five gives room for clock skew between
 * the function and the database without ever reaching a live run.
 */
export const ABANDONED_AFTER_MS = 5 * 60 * 1000;

export async function beginCronRun(
  supabase: SupabaseClient,
  job: SweepJob
): Promise<CronRunHandle> {
  try {
    // Close anything this job left open long enough ago to be certainly dead,
    // so a crash loop reads as failing rather than as quiet. Swallowed like
    // everything else here: bookkeeping must never decide whether the work
    // runs.
    try {
      await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          detail: { abandoned: true, note: "started and never reported a result" },
        })
        .eq("job", job)
        .is("finished_at", null)
        .lt("started_at", new Date(Date.now() - ABANDONED_AFTER_MS).toISOString());
    } catch {
      // Ignored on purpose.
    }

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
