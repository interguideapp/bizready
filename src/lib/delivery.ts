import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/data";
import { allSweepHealth, jobIsDown, type SweepHealth, type SweepJob } from "@/lib/heartbeat";
import {
  anyOutboundChannel,
  anyReach,
  outboundChannels,
  reachableChannels,
  type ChannelReach,
  type OutboundChannels,
} from "@/lib/notify/configured";

/**
 * The heartbeat, whether anything can be sent at all, and whether any of it
 * reaches THIS business.
 *
 * Three independent ways for "we will remind you" to be false, and the product
 * has measured them one at a time, in the order they were discovered:
 *
 *   the sweep never ran            (the heartbeat, migration 029)
 *   no provider is configured      (lib/notify/configured.ts — reminder_log
 *                                   had not one row while the sweep was green)
 *   the provider reaches no one    (this layer: prefs off, no phone, or — for
 *                                   push — not a single subscribed browser)
 *
 * Each was invisible for the same reason: the check that gated the promise was
 * cheaper than the check the sender performs, and it failed in the reassuring
 * direction.
 */
export interface DeliveryHealth {
  sweep: SweepHealth | null;
  /** Providers this deployment has. What /admin needs to know. */
  channels: OutboundChannels;
  /**
   * Channels that reach this business. `null` means we could not find out —
   * which is not the same as "none", and must not be reported as either a
   * working guard or an outage.
   */
  reach: ChannelReach | null;
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
  const [healthRes, reach] = await Promise.all([
    supabase.rpc("sweep_health"),
    loadReach(supabase, channels),
  ]);
  const { data, error } = healthRes;
  // A monitoring read must never break the page it is monitoring. With no
  // answer we say nothing, which is the same position the product was in
  // before this existed.
  if (error) return { sweep: null, channels, reach };
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
  return { sweep, channels, reach };
});

/**
 * The business's own notification settings — for the business the PAGE is
 * showing, which is the part worth being careful about.
 *
 * My first version selected from businesses with .limit(1), and that was a
 * second source of truth for "which business is this". getBusinessContext
 * resolves it in a defined order (owned first, then the earliest accepted
 * membership), and RLS lets a collaborator read more than one row — so an
 * accountant who also owns a business could have been shown one business's
 * obligations beside the other's delivery state. The exact class of split this
 * whole codebase has been consolidating.
 *
 * It is also cheaper: getBusinessContext is request-cached and selects *, so
 * the four preference columns are already in hand and this adds no query at
 * all in the common case.
 *
 * Returns null on any failure — an unreadable answer is reported as unknown
 * rather than guessed, because both guesses are harmful: "reachable" restores
 * the false promise this layer exists to remove, and "unreachable" tells
 * someone their reminders are off when they are not.
 */
async function loadReach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channels: OutboundChannels
): Promise<ChannelReach | null> {
  // getBusinessContext throws on a degraded read (critical()), which must not
  // take down the page it is only annotating.
  let context: Awaited<ReturnType<typeof getBusinessContext>> = null;
  try {
    context = await getBusinessContext();
  } catch {
    return null;
  }
  if (!context) return null;
  const business = context.business;
  // Only asked when it can change the answer: with push unconfigured or
  // switched off, the device count cannot make push reachable.
  let pushDevices = 0;
  if (channels.push && business.notify_push) {
    const { count, error: countError } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);
    if (countError) return null;
    pushDevices = count ?? 0;
  }
  return reachableChannels(channels, {
    notifyEmail: Boolean(business.notify_email),
    notifyPush: Boolean(business.notify_push),
    notifyWhatsapp: Boolean(business.notify_whatsapp),
    hasWhatsappPhone: Boolean(business.whatsapp_phone),
    pushDevices,
  });
}

/**
 * Should the user be told that outbound reminders are not going out?
 *
 * Deliberately not "late": a notice that fires on one missed nightly run gets
 * ignored, and then the real outage is invisible too. Same threshold
 * needsAttention uses, so the admin panel and the user surfaces agree about
 * what counts as broken.
 *
 * Deliberately NOT true for "opted-out" either. A person who switched their
 * own channels off has not suffered an outage, and an alarm bar on four
 * screens about a setting they chose is how a product teaches people to
 * dismiss its warnings. They still must not be TOLD the guard is active —
 * that is remindersWillReach's job, and the two are separate on purpose.
 */
export function deliveryIsDown(health: DeliveryHealth | null): boolean {
  const fault = deliveryFault(health);
  return fault === "unconfigured" || fault === "sweep";
}

/**
 * Which reason applies, for copy that names the real problem.
 *
 * "unconfigured" is not something the reader can fix and must not be phrased as
 * a fault of theirs; "sweep" is an outage of a mechanism that exists;
 * "opted-out" is a setting the reader owns and can change in one tap;
 * "unknown" is our own blindness and gets no claim in either direction.
 */
export function deliveryFault(
  health: DeliveryHealth | null
): "none" | "unconfigured" | "opted-out" | "unknown" | "sweep" {
  if (!health) return "none";
  if (!anyOutboundChannel(health.channels)) return "unconfigured";
  if (health.reach === null) return "unknown";
  if (!anyReach(health.reach)) return "opted-out";
  return jobIsDown(health.sweep) ? "sweep" : "none";
}

/**
 * May a surface state that reminders WILL arrive?
 *
 * The board's green banner used `!deliveryIsDown(delivery)`, and the absence of
 * a known fault is not evidence of delivery. Every silent failure in this
 * pipeline has passed that test: a missing provider did, until configured.ts;
 * an unreadable heartbeat still does; and zero subscribed devices did, which is
 * the state both live businesses were actually in.
 *
 * So the claim now requires the positive answer. "none" is the only value that
 * means a message would leave the building and arrive.
 */
export function remindersWillReach(health: DeliveryHealth | null): boolean {
  return deliveryFault(health) === "none";
}
