import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { allSweepHealth, jobIsDown, type SweepHealth, type SweepJob } from "@/lib/heartbeat";
import {
  anyOutboundChannel,
  outboundChannels,
  type OutboundChannels,
} from "@/lib/notify/configured";

/**
 * The heartbeat plus whether anything can be sent at all.
 *
 * Two independent ways for a promise of "we will remind you" to be false, and
 * the product only ever measured one of them. See lib/notify/configured.ts:
 * with the sweep healthy and no mail provider set, the board claimed the
 * deadline guard was active while reminder_log had not a single row.
 */
export interface DeliveryHealth {
  sweep: SweepHealth | null;
  channels: OutboundChannels;
}

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
export const loadDeliveryHealth = cache(async function loadDeliveryHealth(): Promise<DeliveryHealth> {
  const channels = outboundChannels();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sweep_health");
  // A monitoring read must never break the page it is monitoring. With no
  // answer we say nothing, which is the same position the product was in
  // before this existed.
  if (error) return { sweep: null, channels };
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
  const sweep =
    allSweepHealth(rows, new Date().toISOString()).find((h) => h.job === "reminders") ?? null;
  return { sweep, channels };
});

/**
 * Should the user be told that outbound reminders are not going out?
 *
 * Deliberately not "late": a notice that fires on one missed nightly run gets
 * ignored, and then the real outage is invisible too. Same threshold
 * needsAttention uses, so the admin panel and the user surfaces agree about
 * what counts as broken.
 */
export function deliveryIsDown(health: DeliveryHealth | null): boolean {
  if (!health) return false;
  // No configured channel is not a degraded state, it is the absence of the
  // mechanism. The sweep can be perfectly healthy and still deliver nothing,
  // which is the case that was live: a job that runs is not a message that
  // arrives.
  if (!anyOutboundChannel(health.channels)) return true;
  // jobIsDown, not a fourth copy of the same three-state expression.
  return jobIsDown(health.sweep);
}

/**
 * Which of the two reasons applies, for copy that names the real problem.
 *
 * "unconfigured" is not something the reader can fix and must not be phrased as
 * a fault of theirs; "sweep" is an outage. Telling someone their reminders are
 * delayed when no channel exists would send them to look at a setting that is
 * not the cause.
 */
export function deliveryFault(
  health: DeliveryHealth | null
): "none" | "unconfigured" | "sweep" {
  if (!health) return "none";
  if (!anyOutboundChannel(health.channels)) return "unconfigured";
  return deliveryIsDown(health) ? "sweep" : "none";
}
