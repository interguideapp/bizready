/**
 * Did the scheduled work actually run?
 *
 * Nothing recorded this. The reminder sweep is scheduled daily and sends every
 * email, push and WhatsApp the product promises, and if it stopped there was no
 * signal anywhere — not in the app, not for whoever operates it. A silent
 * scheduler on a compliance product is a promise that quietly stops being kept.
 *
 * The in-app surfaces no longer DEPEND on the sweep (see lib/live-attention.ts:
 * the notifications page derives what is due on load). This is the other half:
 * making the failure visible, so it gets fixed rather than worked around
 * forever.
 *
 * Pure on purpose — the cadences and the staleness verdict are decided here and
 * tested, separately from reading the table.
 */

export type SweepJob = "reminders" | "sync" | "retention" | "source-watch";

/**
 * How often each job is scheduled, and how late is too late.
 *
 * `graceHours` is deliberately generous relative to the schedule: a single
 * missed run can be a platform hiccup, and crying wolf about that would teach
 * whoever sees it to ignore the warning — which costs more than the missed run.
 * What must not be missable is a job that has stopped for good.
 */
export const SWEEP_SCHEDULE: Record<
  SweepJob,
  { label: string; everyHours: number; graceHours: number; critical: boolean }
> = {
  // Daily at 06:00 UTC. This one sends the deadline and overdue reminders, so
  // it is the only job whose silence directly costs the user money.
  reminders: { label: "תזכורות", everyHours: 24, graceHours: 36, critical: true },
  // Daily at 03:00 UTC. Pulls revenue from invoicing software; its silence
  // makes the money figures stale, not wrong.
  sync: { label: "סנכרון חשבוניות", everyHours: 24, graceHours: 48, critical: false },
  // Weekly. Deletes ingested customer data past its retention window, which is
  // a legal obligation of ours rather than a convenience.
  retention: { label: "מחיקת נתונים שפג תוקפם", everyHours: 168, graceHours: 216, critical: true },
  // Weekly. Watches official pages for changes; late means the review queue is
  // late, which a human notices anyway.
  "source-watch": { label: "מעקב מקורות", everyHours: 168, graceHours: 240, critical: false },
};

export interface SweepRun {
  job: SweepJob;
  /** Last run that finished successfully, ISO, or null if there has never been one. */
  lastOkAt: string | null;
  /** Last run that failed, if it is more recent than the last success. */
  lastFailedAt?: string | null;
}

export type SweepState =
  /** Ran within its window. */
  | "ok"
  /** Late, but inside the grace period — probably a hiccup. */
  | "late"
  /** Past grace. Something is broken. */
  | "stale"
  /** Has never run at all. */
  | "never";

export interface SweepHealth {
  job: SweepJob;
  label: string;
  state: SweepState;
  critical: boolean;
  /** Whole hours since the last successful run, or null when there is none. */
  hoursSince: number | null;
  /** True when the most recent attempt failed rather than simply not happening. */
  failing: boolean;
}

/** Hours between two instants, or null when either is unusable. */
function hoursBetween(fromIso: string, nowIso: string): number | null {
  const from = Date.parse(fromIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(from) || Number.isNaN(now)) return null;
  return Math.floor((now - from) / 3_600_000);
}

export function sweepHealth(run: SweepRun, nowIso: string): SweepHealth {
  const schedule = SWEEP_SCHEDULE[run.job];
  const failing = Boolean(
    run.lastFailedAt && (!run.lastOkAt || run.lastFailedAt > run.lastOkAt)
  );

  if (!run.lastOkAt) {
    return {
      job: run.job,
      label: schedule.label,
      // "Never" is distinct from "stale" because it has a different cause:
      // a job that has never run was never wired up, not one that broke.
      state: "never",
      critical: schedule.critical,
      hoursSince: null,
      failing,
    };
  }

  const hoursSince = hoursBetween(run.lastOkAt, nowIso);
  if (hoursSince === null) {
    return {
      job: run.job,
      label: schedule.label,
      state: "never",
      critical: schedule.critical,
      hoursSince: null,
      failing,
    };
  }

  const state: SweepState =
    hoursSince > schedule.graceHours
      ? "stale"
      : hoursSince > schedule.everyHours
        ? "late"
        : "ok";

  return {
    job: run.job,
    label: schedule.label,
    state,
    critical: schedule.critical,
    hoursSince,
    failing,
  };
}

/** Health for every job, including ones with no row at all. */
export function allSweepHealth(runs: SweepRun[], nowIso: string): SweepHealth[] {
  const byJob = new Map(runs.map((r) => [r.job, r] as const));
  return (Object.keys(SWEEP_SCHEDULE) as SweepJob[]).map((job) =>
    sweepHealth(byJob.get(job) ?? { job, lastOkAt: null }, nowIso)
  );
}

/**
 * Is anything wrong enough to tell somebody?
 *
 * Only a CRITICAL job past its grace period, or one that has never run.
 * "late" deliberately does not qualify: a warning that fires on a single
 * missed run gets ignored, and then the real outage is invisible too.
 */
export function needsAttention(health: SweepHealth[]): SweepHealth[] {
  return health.filter(
    (h) => h.critical && (h.state === "stale" || h.state === "never")
  );
}

/** One line naming what is broken and for how long. */
export function sweepSummary(h: SweepHealth): string {
  if (h.state === "never") return `${h.label}: לא רצה מעולם`;
  const days = h.hoursSince === null ? null : Math.floor(h.hoursSince / 24);
  const ago =
    days === null
      ? "לא ידוע"
      : days >= 1
        ? `לפני ${days} ימים`
        : `לפני ${h.hoursSince} שעות`;
  if (h.failing) return `${h.label}: הריצה האחרונה נכשלה (${ago})`;
  if (h.state === "stale") return `${h.label}: לא רצה ${ago}`;
  if (h.state === "late") return `${h.label}: רצה ${ago}, מתעכבת`;
  return `${h.label}: רצה ${ago}`;
}
