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

/**
 * Calendar days from now to a date-only ISO string. Negative when past.
 *
 * ONE DEFINITION, because this is the calculation the whole product turns on
 * -- "is this late?" -- and it was written out twice, byte-identical, in
 * compliance.ts and reminders.ts. The two modules that must never disagree
 * about lateness each held their own copy, so a single edit to either would
 * have made the board and the sweep answer differently for the same filing,
 * silently, with every test still passing.
 *
 * They had not drifted, which is the only reason this is a consolidation and
 * not a bug report: STATUTORY_FILINGS, ConfidenceState and the score credit
 * rule were each declared twice here too, and the third of those HAD drifted.
 *
 * Both copies anchored at UTC midnight and compared against Israel's calendar
 * day, which is the correct contract and is kept exactly: a date-only string
 * carries no zone, and the day it is late relative to is Israel's.
 */
export function daysUntilInIsrael(fromIso: string, now: Date = new Date()): number {
  // Midday on BOTH sides, not midnight.
  //
  // The two copies this replaces used midnight, and numerically it makes no
  // difference: both operands are built from a date string at a fixed UTC
  // time, so the gap is an exact multiple of a day either way, and no DST
  // shift can enter. Midday is used because this file bans the
  // slice + "T00:00:00Z" shape outright -- that instant falls on the previous
  // day for every negative offset, which is a real defect on the DISPLAY path
  // in the same module. Satisfying the ban rather than carving an exception
  // into it keeps the ban blanket, and a blanket ban is the one that still
  // works on the next person's edit.
  const from = new Date(fromIso.slice(0, 10) + "T12:00:00Z");
  const today = new Date(todayInIsrael(now) + "T12:00:00Z");
  return Math.round((from.getTime() - today.getTime()) / 86_400_000);
}

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

/**
 * AN INSTANT, rendered as the day it happened IN ISRAEL.
 *
 * formatHeDate above fixed the deadlines. It cannot fix these, and using it
 * here would be worse than the bug: it slices the first ten characters, and
 * for a timestamptz those ten characters are the UTC calendar day. A task
 * completed at 2026-09-14T22:30:00Z happened on the 15th in Israel, and
 * slicing says the 14th.
 *
 * What the code did instead was `new Date(iso).toLocaleDateString("he-IL")` —
 * the instant formatted in whatever zone the RENDERER is in. On a Vercel
 * server that is UTC, so the same evening action shows as the previous day for
 * every Israeli user; in a client component it is the viewer's browser, so it
 * varies by traveller. Sixteen sites did this.
 *
 * Where they did it is what makes it matter: completed_at on /tracking,
 * task_events on the activity trail, filedAt in the filing history, created_at
 * on documents, the evidence pack's own generation date. The surfaces whose
 * whole purpose is answering "when did this happen" — and the answer was
 * wrong for the two to three hours each evening when Israel has already
 * turned the page. "Filed on the 15th" and "filed on the 14th" is the
 * difference between on time and late for a filing due on the 15th.
 *
 * Takes a full timestamp. Anything unparseable comes back untouched rather
 * than as "Invalid Date".
 */
export function formatHeMoment(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // heDate carries timeZone: Asia/Jerusalem, so formatting an instant with it
  // asks the only question worth asking: which Israeli day was that?
  return heDate.format(d);
}

const heMomentWithTime = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** An instant with the clock time, in Israel — for logs where the hour matters. */
export function formatHeMomentWithTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return heMomentWithTime.format(d);
}

const heMomentDayMonth = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "numeric",
});

/** An instant as `15.9` in Israel — for tight rows where the year is obvious. */
export function formatHeMomentDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return heMomentDayMonth.format(d);
}

const heMomentLongMonth = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
});

/** An instant as `15 בספטמבר` in Israel — the alerts list's own form. */
export function formatHeMomentLongMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return heMomentLongMonth.format(d);
}

/**
 * The shape of a date-only ISO string, as a source pattern with no escapes.
 *
 * setTaskDueDate validated its input with a literal whose digit classes had
 * lost their backslash level, so it read as four literal letter-d characters.
 * It rejected "2026-09-15" and every other real date, and threw
 * "invalid date" on every call -- which means the personal-deadline feature
 * (migration 028) could never store a date at all. Measured on the live
 * database: 87 tasks, ZERO with a personal_due_date.
 *
 * The product promises to remind you about a personal target, and the target
 * could not be set. Character classes rather than escapes, so no editing
 * route can eat a backslash again.
 */
export const ISO_DATE_SHAPE = "[0-9]{4}-[0-9]{2}-[0-9]{2}";


/**
 * The shape of a year-month key, no escapes, same reasoning as above.
 */
export const ISO_MONTH_SHAPE = "[0-9]{4}-[0-9]{2}";

/**
 * PREDICATES, SO A CALLER STATES INTENT INSTEAD OF RESPELLING A PATTERN.
 *
 * Eight sites validated one of these shapes with their own inline regex.
 * All eight were correct -- the eaten-escapes sweep proves no mangling -- and
 * eight spellings of one rule is how the two that were NOT correct
 * (markPeriodFiled and setTaskDueDate) went unnoticed for as long as they
 * did: the pattern is familiar, so a broken copy reads as fine.
 *
 * Two shapes are genuinely different and both get a name. isIsoDate asks
 * whether a value IS a date, for an input the product will store. Whereas
 * startsWithIsoDate asks whether a TIMESTAMP begins with one, which is what
 * renewals and the ceiling coverage check want -- they are handed
 * completed_at and metric_date and care only about the prefix.
 *
 * The most consequential pair was complete-task-flow (client) and
 * updateDocument (server) validating the same typed date with two separate
 * copies. Divergence there means the browser accepts what the server
 * refuses, and the user sees a rejection with no field to fix.
 */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && new RegExp("^" + ISO_DATE_SHAPE + "$").test(value);
}

export function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && new RegExp("^" + ISO_MONTH_SHAPE + "$").test(value);
}

/** A timestamp (or date) whose first ten characters are a calendar date. */
export function startsWithIsoDate(value: unknown): value is string {
  return typeof value === "string" && new RegExp("^" + ISO_DATE_SHAPE).test(value);
}


/**
 * A value whose first seven characters are a year-month.
 *
 * Separate from isIsoMonth because the difference is deliberate and tested:
 * revenueCoverage is handed either a month key or a full date and reads the
 * month off either. Narrowing it to isIsoMonth broke that test, which is
 * exactly what the test is for -- the prefix behaviour is a decision, not an
 * accident of an unanchored regex.
 */
export function startsWithIsoMonth(value: unknown): value is string {
  return typeof value === "string" && new RegExp("^" + ISO_MONTH_SHAPE).test(value);
}
