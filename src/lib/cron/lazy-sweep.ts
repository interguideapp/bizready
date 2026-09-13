import { createAdminClient } from "@/lib/supabase/admin";
import { check } from "@/lib/rate-limit";
import { allSweepHealth, type SweepJob, type SweepRun } from "@/lib/heartbeat";
import { jobsDue } from "@/lib/cron/due";

/**
 * Run the scheduled work off ordinary traffic, when the scheduler is dead.
 *
 * WHY. Every reminder this product sends comes from a cron trigger, and that
 * trigger is the one part of the system I cannot make work from here: Vercel
 * only sends the authorization header when CRON_SECRET is set, and setting an
 * environment variable is not something this environment can do. So the
 * product's outbound promise was hostage to a single piece of configuration.
 *
 * This removes the hostage-taking. Any authenticated page render checks the
 * heartbeat and, if the sweep has genuinely stopped, runs it after the response
 * has been sent. No secret, no second scheduler, no egress from the database,
 * no new endpoint — the work is already here and already authorized by being
 * inside a rendered page.
 *
 * IT DISABLES ITSELF. The only gate that matters is the heartbeat: while a real
 * cron is running, jobsDue returns nothing and this costs one cheap RPC. It is
 * a fallback that vanishes the moment the proper mechanism works, which is the
 * opposite of a parallel system competing with it.
 *
 * WHAT IT DOES NOT FIX. A business whose owner never opens the app, on an
 * account whose cron is dead, still hears nothing — one visit by anyone sweeps
 * every business, but if nobody visits at all there is no trigger. This turns
 * "nothing is ever sent" into "sent whenever the product is used, at most once
 * an hour". That is a large improvement and not the same thing as a working
 * scheduler, and the delivery notice keeps saying so.
 */

/** At most one lazy sweep an hour, across every render and every instance. */
const CLAIM_KEY = "lazy-sweep";
const CLAIM_WINDOW_MS = 60 * 60 * 1000;

export async function sweepIfScheduleIsDead(): Promise<
  { ran: SweepJob[] } | { ran: []; reason: string }
> {
  try {
    const supabase = createAdminClient();

    const { data: health, error } = await supabase.rpc("sweep_health");
    if (error) return { ran: [], reason: "heartbeat unreadable" };

    const runs: SweepRun[] = (
      (health ?? []) as { job: string; last_ok_at: string | null; last_failed_at: string | null }[]
    ).map((r) => ({
      job: r.job as SweepJob,
      lastOkAt: r.last_ok_at,
      lastFailedAt: r.last_failed_at,
    }));

    // The same decision the cron dispatcher makes, from the same function, so a
    // lazy run and a scheduled run can never disagree about what is due.
    const due = jobsDue(runs, new Date().toISOString());
    if (due.length === 0) return { ran: [], reason: "nothing due" };

    // Only worth doing at all if the schedule is actually not running. A job
    // merely "due" because the cron is about to fire in ten minutes should be
    // left to the cron.
    const remindersHealth = allSweepHealth(runs, new Date().toISOString()).find(
      (h) => h.job === "reminders"
    );
    const scheduleLooksDead =
      remindersHealth?.state === "never" || remindersHealth?.state === "stale";
    if (!scheduleLooksDead) return { ran: [], reason: "schedule looks alive" };

    // THE CLAIM. Without it, ten concurrent page renders start ten sweeps.
    // Durable and Postgres-backed (the per-isolate Map it replaced never
    // limited anything on serverless), so the limit holds across instances.
    // The jobs also dedupe by key, so the worst case was duplicated work rather
    // than duplicated messages — but duplicated work on a 60s budget is its own
    // way to fail.
    const claim = await check(CLAIM_KEY, 1, CLAIM_WINDOW_MS);
    if (!claim.ok) return { ran: [], reason: "another sweep claimed this hour" };
    // check() fails OPEN when its own RPC errors — correct for a rate limiter
    // guarding a public form, where locking real users out is the worse
    // outcome, and wrong here. A claim that cannot be taken must block, or a
    // database hiccup turns every concurrent render into its own sweep.
    if (claim.degraded) return { ran: [], reason: "claim unavailable" };

    // Imported lazily: this pulls in the whole notification stack, and it must
    // not be loaded on the render path of every page that never sweeps.
    const { RUNNERS } = await import("@/app/api/cron/daily/route");

    const ran: SweepJob[] = [];
    // Reminders only. The others are not urgent enough to justify spending an
    // authenticated user's response budget on, and retention in particular
    // deletes data — that should happen on a schedule an operator chose, or
    // from /admin deliberately, not as a side effect of somebody opening a page.
    if (due.includes("reminders")) {
      await RUNNERS.reminders();
      ran.push("reminders");
    }
    return { ran };
  } catch (e) {
    // A fallback that can break a page is worse than no fallback.
    console.error("[lazy-sweep] failed", e);
    return { ran: [], reason: "threw" };
  }
}
