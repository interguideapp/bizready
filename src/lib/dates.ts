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

/**
 * A date-only `yyyy-mm-dd` rendered for a Hebrew reader, pinned to Israel.
 *
 * The pinning is the point. Thirty-four places formatted dates by hand, and the
 * shared formatHe did `new Date(iso + "T00:00:00Z").toLocaleDateString("he-IL")`
 * — parsed as UTC midnight, then rendered in whatever zone the RENDERER is in.
 * On the server that is UTC and harmless. In a client component it is the
 * viewer's browser, and for any negative offset the instant falls on the
 * previous day:
 *
 *   deadline 2026-09-15, viewer in America/New_York  ->  14.9.2026
 *
 * Measured, not assumed. One day early on every deadline, for an owner
 * travelling or with a browser set to another zone, in the product whose whole
 * value is the date. todayInIsrael already decided that the calendar day is
 * Israel's; this makes the DISPLAYED day agree with it.
 *
 * An unparseable value comes back untouched rather than as "Invalid Date".
 */
const heDate = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const heDayMonth = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "numeric",
});

/** `15.9.2026`. Takes a date-only ISO; anything else is returned as given. */
export function formatHeDate(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return heDate.format(d);
}

/** `15.9`, for tight rows where the year is already obvious. */
export function formatHeDayMonth(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return heDayMonth.format(d);
}
