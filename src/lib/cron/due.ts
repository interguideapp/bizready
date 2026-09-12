import { SWEEP_SCHEDULE, type SweepJob, type SweepRun } from "@/lib/heartbeat";

/**
 * Which scheduled jobs are due, in the order they matter.
 *
 * WHY THIS EXISTS. vercel.json declared four cron entries. The Vercel account
 * is on the **Hobby** plan, which allows a maximum of TWO cron jobs per
 * project — so the cron configuration was invalid and, as far as three days of
 * grouped runtime logs could show, not one `/api/cron/*` request ever arrived.
 * Every reminder this product sends depends on that sweep. The engines were
 * therefore rebuilt to derive everything at read time (see cycles.ts), which
 * keeps the screens correct, but a user who never opens the app still hears
 * nothing.
 *
 * So the four entries collapse into ONE daily dispatcher, which fits the plan
 * with a slot to spare, and this decides what that single invocation should
 * run today.
 *
 * Cadence is read from the HEARTBEAT, not from the day of the week. Hobby
 * triggers a cron within a window rather than at an exact minute, and a
 * day-of-week test would skip a weekly job outright if its day happened to be
 * the invocation that was missed. "Has it been a week since retention last
 * succeeded" cannot skip: it just stays true until the job runs.
 */

/**
 * Order of execution, most consequential first.
 *
 * A single invocation has a wall-clock budget (60s on Hobby), so if anything
 * gets dropped it must be the job whose lateness costs least. Reminders are
 * the only job whose silence costs the user money; retention is a legal duty
 * of ours; sync makes figures stale rather than wrong; source-watch feeds a
 * review queue a human reads anyway.
 */
export const JOB_PRIORITY: readonly SweepJob[] = [
  "reminders",
  "retention",
  "sync",
  "source-watch",
];

function hoursSince(iso: string | null, nowIso: string): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return (now - then) / 3_600_000;
}

/**
 * Jobs whose cadence has elapsed, highest priority first.
 *
 * A job that has never succeeded is always due — that is the state the project
 * is actually in, and treating "no record" as "not due yet" would keep it that
 * way forever.
 *
 * `slack` shaves a little off each cadence so a job scheduled every 24 hours is
 * not skipped by an invocation arriving 23h55m after the last one. Without it a
 * daily job would silently become every-other-day whenever the trigger drifted
 * earlier, which is exactly the failure this whole file exists to prevent.
 */
export function jobsDue(runs: SweepRun[], nowIso: string, slackHours = 1): SweepJob[] {
  const byJob = new Map(runs.map((r) => [r.job, r] as const));
  return JOB_PRIORITY.filter((job) => {
    const since = hoursSince(byJob.get(job)?.lastOkAt ?? null, nowIso);
    if (since === null) return true;
    return since >= SWEEP_SCHEDULE[job].everyHours - slackHours;
  });
}
