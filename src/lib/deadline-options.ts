import { filingRuleFor, type DateRule } from "@/lib/content/filing-rules";

/**
 * The dates a user can pick from when setting a deadline, computed rather than
 * typed.
 *
 * The editor was a bare `<input type="date">`. To say "remind me in two weeks"
 * you had to work out the date yourself and type it, and to align with a
 * statutory deadline you had to know what that deadline was — which the product
 * knew and did not offer. For a demand-triggered obligation like הצהרת הון
 * ("120 days from the demand") it was worse than that: the arithmetic was left
 * entirely to the user, on a date whose lateness carries a penalty.
 *
 * THE ONE RULE HERE
 *
 * An official date is only ever offered when it comes from the filing-rules
 * registry, which carries a source URL and a human verification date per rule.
 * Nothing in this file invents a deadline, and a rule whose date the authority
 * has not published yet (the annual return, announced each spring) offers
 * nothing rather than a guess. That is the same principle the rest of the date
 * engine follows: no date without a basis.
 */

export type DeadlineOptionKind =
  /** Relative to today — "בעוד שבוע". Ours, arbitrary, and honest about it. */
  | "relative"
  /** A calendar boundary — end of this month. */
  | "boundary"
  /** From the filing-rules registry. Carries a source. */
  | "official";

export interface DeadlineOption {
  id: string;
  label: string;
  date: string;
  kind: DeadlineOptionKind;
  /** Only on official options: why this date is what it is. */
  note?: string;
  /** Only on official options: the page the rule was read from. */
  source?: string;
}

/** Add days to an ISO date in UTC, so no local timezone can shift the result. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The last day of the month `iso` falls in. */
function endOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

/**
 * "In a week", and the rest.
 *
 * Deliberately short. A picker with twelve choices is not easier than a date
 * field, it is just a different kind of work — these are the four spans people
 * actually mean plus the month boundary, which is when most business admin
 * gets done.
 */
export function relativeOptions(todayIso: string): DeadlineOption[] {
  const out: DeadlineOption[] = [
    { id: "tomorrow", label: "מחר", date: addDays(todayIso, 1), kind: "relative" },
    { id: "week", label: "בעוד שבוע", date: addDays(todayIso, 7), kind: "relative" },
    { id: "two-weeks", label: "בעוד שבועיים", date: addDays(todayIso, 14), kind: "relative" },
    { id: "month", label: "בעוד חודש", date: addDays(todayIso, 30), kind: "relative" },
  ];

  // Only worth offering when it is not the same as one of the above, and not
  // today — "end of the month" on the 30th is noise.
  const eom = endOfMonth(todayIso);
  if (eom !== todayIso && !out.some((o) => o.date === eom)) {
    out.push({ id: "end-of-month", label: "סוף החודש", date: eom, kind: "boundary" });
  }
  return out;
}

/**
 * Is this rule's date something we can compute without asking the user?
 *
 * `on_demand` cannot be: the clock starts from a letter we never see. `annual`
 * with `announcedOnly` cannot be either, for a year the authority has not
 * published — which is exactly the case the annual-return rule documents.
 */
export function isComputable(rule: DateRule, taxYear: number): boolean {
  if (rule.anchor === "on_demand") return false;
  if (rule.anchor === "annual" && rule.announcedOnly) {
    return Boolean(rule.announced?.[taxYear]);
  }
  return true;
}

/**
 * The official date for a task, when the registry has one.
 *
 * The statutory date itself is computed by the compliance engine, which knows
 * the business's reporting frequency; this takes that date as an argument
 * rather than recomputing it, so there is one implementation of the hard part
 * and no chance of the picker disagreeing with the rest of the product about
 * when a filing is due.
 */
export function officialOptions(
  templateId: string,
  statutoryDueDate: string | null
): DeadlineOption[] {
  const entry = filingRuleFor(templateId);
  if (!entry || !statutoryDueDate) return [];

  return [
    {
      id: "statutory",
      label: "המועד החוקי",
      date: statutoryDueDate,
      kind: "official",
      note: entry.note,
      source: entry.source,
    },
  ];
}

/**
 * A few days before the official date, so the user has room to prepare.
 *
 * Offered separately from the deadline itself because setting a personal target
 * ON the legal date leaves no slack at all, and the slack is the point of
 * letting someone choose a date. Skipped when it would land in the past.
 */
export function prepareBeforeOption(
  statutoryDueDate: string | null,
  todayIso: string,
  daysBefore = 7
): DeadlineOption | null {
  if (!statutoryDueDate) return null;
  const target = addDays(statutoryDueDate, -daysBefore);
  if (target <= todayIso) return null;
  return {
    id: "prepare-before",
    label: `שבוע לפני המועד החוקי`,
    date: target,
    kind: "boundary",
  };
}

/**
 * The deadline for a demand-triggered obligation, given the date on the demand.
 *
 * הצהרת הון is the case this exists for: the rule is "120 days from receiving
 * the demand", the product cannot see the letter, and until now the user had to
 * do that arithmetic themselves. Returns null when the task has no such rule,
 * so a caller cannot accidentally apply it to a filing with a real calendar
 * deadline.
 */
export function onDemandDeadline(
  templateId: string,
  demandDateIso: string
): { date: string; days: number } | null {
  const entry = filingRuleFor(templateId);
  if (!entry || entry.rule.anchor !== "on_demand") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(demandDateIso)) return null;
  const date = addDays(demandDateIso, entry.rule.days);
  if (date === demandDateIso) return null;
  return { date, days: entry.rule.days };
}

/** True when this task's deadline is only knowable from a demand we cannot see. */
export function isDemandTriggered(templateId: string): boolean {
  return filingRuleFor(templateId)?.rule.anchor === "on_demand";
}

/**
 * Why a chosen date is a problem, or null when it is fine.
 *
 * The only case worth interrupting someone for is a personal target set AFTER
 * a statutory deadline, because that is not a preference — it plans to be late,
 * and lateness on these filings carries interest from day one. A date in the
 * past is left alone: back-dating a task you already handled is legitimate.
 */
export function deadlineWarning(
  chosenDate: string,
  statutoryDueDate: string | null
): string | null {
  if (!statutoryDueDate || !chosenDate) return null;
  if (chosenDate <= statutoryDueDate) return null;
  return `המועד החוקי הוא ${formatHe(statutoryDueDate)} — תאריך מאוחר ממנו חושף לקנס ולריבית.`;
}

/**
 * Which date to SHOW for a task, and where it came from.
 *
 * One implementation, because two places deciding what a task's date is, is
 * precisely how the product once ended up inventing overdue statutory debts:
 * the home screen computed it from a stale column while the compliance engine
 * applied the real rule, and the screen won.
 *
 * The rule:
 *
 *   Statutory     the law's date. A personal target cannot move it, so it is
 *                 shown as a separate, secondary fact and never in its place.
 *   Otherwise     the user's date when they set one. There is no legal fact to
 *                 protect, so their choice simply is the deadline.
 */
export function effectiveDeadline(args: {
  personal: string | null | undefined;
  system: string | null | undefined;
  statutory: boolean;
}): { date: string | null; from: "personal" | "system" | "none" } {
  const personal = args.personal ?? null;
  const system = args.system ?? null;

  if (args.statutory) {
    if (system) return { date: system, from: "system" };
    // No legal date computed yet (an annual return before it is announced).
    // A personal target is then the only date there is.
    return personal ? { date: personal, from: "personal" } : { date: null, from: "none" };
  }

  if (personal) return { date: personal, from: "personal" };
  return system ? { date: system, from: "system" } : { date: null, from: "none" };
}

/** A date as a business owner reads it, not as a database stores it. */
export function formatHe(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

/** How the option list describes a date to distinguish two picks on the same day. */
export function optionSubtitle(option: DeadlineOption): string {
  return formatHe(option.date);
}

/**
 * The whole set for a task, deduplicated.
 *
 * Official dates come first: when the law has an opinion it is the most useful
 * thing on the list, and burying it under "in a week" would repeat the mistake
 * this replaces. Two options landing on the same day collapse to the one with
 * the better provenance.
 */
export function deadlineOptions(args: {
  templateId: string;
  todayIso: string;
  statutoryDueDate: string | null;
}): DeadlineOption[] {
  const { templateId, todayIso, statutoryDueDate } = args;
  const official = officialOptions(templateId, statutoryDueDate);
  const prepare = prepareBeforeOption(statutoryDueDate, todayIso);

  const ordered = [...official, ...(prepare ? [prepare] : []), ...relativeOptions(todayIso)];

  const seen = new Set<string>();
  const out: DeadlineOption[] = [];
  for (const o of ordered) {
    // Never offer a date that has already passed — it cannot be a deadline.
    if (o.date < todayIso) continue;
    if (seen.has(o.date)) continue;
    seen.add(o.date);
    out.push(o);
  }
  return out;
}
