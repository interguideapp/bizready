/**
 * One authority for "what is today".
 *
 * The app used to compute today as `new Date().toISOString().slice(0, 10)` —
 * i.e. in UTC. Israel is UTC+2/+3, so between local midnight and 02:00/03:00
 * that returns YESTERDAY. That made the overdue comparison, task
 * prioritisation and the whole filing calendar off by one day for two to three
 * hours every night, in a product whose entire value is deadline accuracy.
 *
 * Everything that asks "is this late?" or "which period are we in?" must go
 * through here. Pure calendar construction (Date.UTC(y, m, d) -> iso) stays as
 * it is: those are dates, not moments.
 */

const TZ = "Asia/Jerusalem";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Israel, as `yyyy-mm-dd`. */
export function todayInIsrael(now: Date = new Date()): string {
  return ymd.format(now);
}

/** Israel-local calendar parts. `month` is 0-based, matching Date. */
export function israelParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = ymd.format(now).split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/**
 * Is `iso` within the last `ms`?
 *
 * Exists so a component does not read the clock in its own render body. That
 * was flagged as an impure render call in plan-ready, and the reason it matters
 * beyond the lint rule is that the window it guards had no test: /plan-ready
 * re-showed "התכנית מוכנה" on every later visit until a window was added, and
 * nothing asserted the window worked. A null or unparseable timestamp returns
 * false, so a missing date never counts as "just now".
 */
export function withinLastMs(iso: string | null, ms: number, now: Date = new Date()): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return false;
  return now.getTime() - then <= ms;
}
