import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { allSweepHealth, type SweepHealth, type SweepJob } from "@/lib/heartbeat";

/**
 * Is the product still able to reach the user?
 *
 * Everything on screen is derived, so a dead scheduler cannot make a screen
 * wrong. What it does make wrong is the user's assumption: someone who has been
 * told the product will email them before a deadline will stop checking, and if
 * the sweep is not running nothing is emailed. The screens stay honest and the
 * silence lies.
 *
 * The heartbeat (029) has recorded this all along and only /admin read it. A
 * business owner cannot see /admin, so the one person whose deadlines are at
 * stake was the one person not told.
 *
 * sweep_health() is SECURITY DEFINER and returns nothing but job names and
 * timestamps — no tenant data, no error text — which is exactly why it exists
 * as a summary function rather than as table access.
 */
export const loadDeliveryHealth = cache(async function loadDeliveryHealth(): Promise<
  SweepHealth | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sweep_health");
  // A monitoring read must never break the page it is monitoring. With no
  // answer we say nothing, which is the same position the product was in
  // before this existed.
  if (error) return null;
  const rows = (
    (data ?? []) as {
      job: string;
      last_ok_at: string | null;
      last_failed_at: string | null;
    }[]
  ).map((r) => ({
    job: r.job as SweepJob,
    lastOkAt: r.last_ok_at,
    lastFailedAt: r.last_failed_at,
  }));
  // allSweepHealth fills in jobs with no row at all as "never", which is the
  // case that actually matters: an empty cron_runs table is a scheduler that
  // has not run once, and reporting that as healthy would be the worst
  // possible reading.
  return allSweepHealth(rows, new Date().toISOString()).find((h) => h.job === "reminders") ?? null;
});

/**
 * Should the user be told that outbound reminders are not going out?
 *
 * Deliberately not "late": a notice that fires on one missed nightly run gets
 * ignored, and then the real outage is invisible too. Same threshold
 * needsAttention uses, so the admin panel and the user surfaces agree about
 * what counts as broken.
 */
export function deliveryIsDown(health: SweepHealth | null): boolean {
  if (!health) return false;
  return health.state === "stale" || health.state === "never" || health.failing;
}
