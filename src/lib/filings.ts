import type { VatFrequency } from "@/lib/compliance";

/**
 * Period identity for recurring statutory filings — which periods exist, which
 * were filed, and therefore which were missed.
 *
 * WHY THIS HAD TO EXIST
 *
 * Nothing recorded which period a filing covered. `completion_data` holds the
 * evidence for the LATEST completion and is overwritten every period, so the
 * product could not answer "have I filed Jul–Aug?" — a core question for a
 * compliance tool, and the thing an evidence pack most needs to contain.
 *
 * The consequence was concrete. The obligations engine infers a missed period
 * from the deadline stored on the task row, which works for exactly one: the
 * sweep leaves that column at the oldest unfiled deadline, so a business two
 * periods behind was told about the first and never the second. The user least
 * able to catch up — the one who already fell behind — got the least help.
 *
 * The period algebra lives here, once. compliance.ts consumes it rather than
 * keeping a second copy, because two implementations of "which period is this"
 * is how a filing ends up recorded against the wrong months.
 *
 * Israeli VAT and income-tax advances are filed for fixed calendar periods —
 * whole months, or whole bimonths (Jan–Feb, Mar–Apr, …) — by the 15th of the
 * month following the period's end.
 */

const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/**
 * The date the product started recording which periods were filed.
 *
 * Before this there is no ledger, and treating an absent record as an absent
 * filing would have accused every existing user of months of non-compliance
 * the day migration 030 shipped. Periods whose deadline falls earlier are left
 * to the single-period heuristic, which is all there was.
 */
export const FILING_RECORD_SINCE = "2026-09-12";

export interface FilingPeriod {
  /**
   * Stable identity, stored in the database: "2026-07..2026-08", or
   * "2026-08..2026-08" for a monthly filer.
   *
   * Built from the period itself rather than from the deadline, so a key stays
   * correct even if a filing deadline is ever changed by law.
   */
  key: string;
  /** Absolute month index (year * 12 + month), inclusive. */
  startAbs: number;
  endAbs: number;
  /** The 15th of the month after the period ends. */
  dueIso: string;
  /** "יולי–אוגוסט 2026". */
  label: string;
}

function ym(abs: number): { year: number; month: number } {
  return { year: Math.floor(abs / 12), month: abs % 12 };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-07" for an absolute month index. */
function monthKey(abs: number): string {
  const { year, month } = ym(abs);
  return `${year}-${pad(month + 1)}`;
}

export function periodLabel(startAbs: number, endAbs: number): string {
  const s = ym(startAbs);
  const e = ym(endAbs);
  if (startAbs === endAbs) return `${HE_MONTHS[s.month]} ${s.year}`;
  return s.year === e.year
    ? `${HE_MONTHS[s.month]}–${HE_MONTHS[e.month]} ${e.year}`
    : `${HE_MONTHS[s.month]} ${s.year} – ${HE_MONTHS[e.month]} ${e.year}`;
}

/** The deadline for a period: the 15th of the month after it ends. */
export function dueForPeriod(endAbs: number): string {
  const { year, month } = ym(endAbs + 1);
  return `${year}-${pad(month + 1)}-15`;
}

/** Build the period a given end-month belongs to, for a frequency. */
export function periodEndingAt(endAbs: number, frequency: VatFrequency): FilingPeriod {
  const step = frequency === "monthly" ? 1 : 2;
  const startAbs = endAbs - (step - 1);
  return {
    key: `${monthKey(startAbs)}..${monthKey(endAbs)}`,
    startAbs,
    endAbs,
    dueIso: dueForPeriod(endAbs),
    label: periodLabel(startAbs, endAbs),
  };
}

/**
 * The period a given deadline belonged to.
 *
 * Used when recording a filing: at completion time the only reliable statement
 * of "which period am I filing for" is the deadline stored on the task row,
 * because a late filer's calendar position no longer points at it. Computing
 * the period from today's date would file a late submission against the wrong
 * months.
 */
export function periodForDue(
  dueIso: string,
  frequency: VatFrequency
): FilingPeriod | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dueIso);
  if (!m) return null;
  const dueAbs = Number(m[1]) * 12 + (Number(m[2]) - 1);
  // Guard against a nonsense month from a malformed-but-matching string.
  if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return periodEndingAt(dueAbs - 1, frequency);
}

/**
 * Is this month a valid period end for the frequency?
 *
 * Bimonthly periods are Jan–Feb, Mar–Apr and so on, so they always end on an
 * odd month index (Feb = 1). Without this check a bimonthly filer would be
 * given periods ending in January, which do not exist.
 */
function isPeriodEnd(endAbs: number, frequency: VatFrequency): boolean {
  return frequency === "monthly" || endAbs % 2 === 1;
}

/**
 * Every period whose deadline has already passed, oldest first.
 *
 * `fromIso` is where counting starts — the business's first deadline for this
 * filing. Periods before a business existed are not its obligations, and
 * enumerating from an arbitrary epoch would invent years of debt.
 *
 * Capped: a business that has not filed for a decade is a conversation with an
 * accountant, not a list this product should generate, and an uncapped loop on
 * a bad date is a hang.
 */
export function periodsDueSince(args: {
  fromIso: string;
  todayIso: string;
  frequency: VatFrequency;
  maxPeriods?: number;
}): FilingPeriod[] {
  const { fromIso, todayIso, frequency, maxPeriods = 24 } = args;
  const from = /^(\d{4})-(\d{2})-\d{2}$/.exec(fromIso);
  const today = /^(\d{4})-(\d{2})-\d{2}$/.exec(todayIso);
  if (!from || !today) return [];

  const fromPeriod = periodForDue(fromIso, frequency);
  if (!fromPeriod) return [];

  const todayAbs = Number(today[1]) * 12 + (Number(today[2]) - 1);
  const out: FilingPeriod[] = [];

  // Walk period ends forward from the first one, stopping at the last whose
  // deadline is already behind us.
  for (
    let endAbs = fromPeriod.endAbs;
    endAbs <= todayAbs + 1 && out.length < maxPeriods;
    endAbs++
  ) {
    if (!isPeriodEnd(endAbs, frequency)) continue;
    const period = periodEndingAt(endAbs, frequency);
    // Strictly passed: a deadline falling today has not been missed.
    if (period.dueIso >= todayIso) break;
    out.push(period);
  }

  return out;
}

/** A filing the business has recorded. */
export interface RecordedFiling {
  templateId: string;
  periodKey: string;
}

/**
 * Periods with a passed deadline and no recorded filing.
 *
 * The answer is only as good as the record: a business that filed for months
 * before this recording existed has no rows, and every one of those periods
 * would look missed. `knownFrom` is what prevents that — see
 * missedPeriodsFor, which will not look further back than the point where the
 * product started keeping the record.
 */
export function missedPeriods(
  due: FilingPeriod[],
  filedKeys: Iterable<string>
): FilingPeriod[] {
  const filed = new Set(filedKeys);
  return due.filter((p) => !filed.has(p.key));
}

/**
 * The periods a business owes and has not filed.
 *
 * `knownFrom` is the honesty guard. Recording filings started at a point in
 * time; before it there is no record, and treating absence of a record as
 * absence of a filing would accuse every existing user of years of
 * non-compliance the moment this shipped. So nothing earlier than `knownFrom`
 * is ever reported, and the caller keeps using the single-period heuristic for
 * that older history.
 */
export function missedPeriodsFor(args: {
  firstDueIso: string;
  todayIso: string;
  frequency: VatFrequency;
  filedKeys: Iterable<string>;
  knownFrom: string;
  maxPeriods?: number;
}): FilingPeriod[] {
  const due = periodsDueSince({
    fromIso: args.firstDueIso,
    todayIso: args.todayIso,
    frequency: args.frequency,
    maxPeriods: args.maxPeriods,
  }).filter((p) => p.dueIso >= args.knownFrom);
  return missedPeriods(due, args.filedKeys);
}

/**
 * The ledger key for ANY filing, not just a bimonthly reporting period.
 *
 * The ledger write used periodForDue unconditionally, which reads a deadline as
 * if it closed a two-month VAT period. So paying the 31 March registrar fee was
 * recorded against "ינואר–פברואר 2027" — a period that has nothing to do with
 * an annual fee. Nothing read it, so nothing broke; but the ledger is the
 * evidence record, and a row that mislabels what it is evidence OF is worth
 * less than no row.
 *
 * One key shape per anchor:
 *   period_plus  the reporting period the deadline closes ("2026-07..2026-08")
 *   monthly      the single month it closes ("2026-08..2026-08")
 *   annual       the full year the filing covers ("2026-01..2026-12")
 *   on_demand    none — there is no period, and naming one would invent a fact
 */
export function ledgerPeriodFor(args: {
  anchor: "period_plus" | "monthly" | "annual" | "on_demand";
  dueIso: string;
  frequency: VatFrequency;
  /** True for a fee billed FOR the year it falls in, rather than the year before. */
  coversDueYear?: boolean;
}): { key: string; label: string; dueIso: string } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(args.dueIso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;

  switch (args.anchor) {
    case "period_plus": {
      const p = periodForDue(args.dueIso, args.frequency);
      return p ? { key: p.key, label: p.label, dueIso: args.dueIso } : null;
    }
    case "monthly": {
      // The month a monthly filing closes is the one before its deadline.
      const endAbs = year * 12 + (month - 1) - 1;
      const p = periodEndingAt(endAbs, "monthly");
      return { key: p.key, label: p.label, dueIso: args.dueIso };
    }
    case "annual": {
      const covered = args.coversDueYear ? year : year - 1;
      return {
        key: `${covered}-01..${covered}-12`,
        label: `שנת ${covered}`,
        dueIso: args.dueIso,
      };
    }
    case "on_demand":
      return null;
  }
}
