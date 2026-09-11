import { todayInIsrael, israelParts } from "@/lib/dates";
import { dismissalOf, satisfiesDependency, type Dismissal } from "@/lib/task-status";
import {
  DATED_FILING_IDS,
  announcedDateFor,
  filingRuleFor,
  nextAnnouncedFiling,
  type FilingRule,
} from "@/lib/content/filing-rules";
import type { TaskStatus, TaskTemplate } from "@/lib/types";

/**
 * The Compliance Guardian's calendar engine.
 *
 * Turns the business's real, statutory obligations — VAT / income-tax advances,
 * the annual report, insurance/licence renewals and document expiries — into
 * concrete, calendar-anchored due dates, each one carrying the RULE it came from
 * and an official SOURCE. That transparency is the whole point: a date you can
 * see the reasoning behind is a date you can trust, unlike a drifting "+30 days".
 *
 * Pure & tested. Every filing date is computed from the actual Israeli reporting
 * calendar and personalized by the business's reporting frequency.
 */

export type ObligationKind =
  | "vat" // דיווח מע"מ
  | "advances" // מקדמות מס (מס הכנסה או ביטוח לאומי)
  | "annual_report" // דוח שנתי
  | "employer_deductions" // דיווח ניכויים חודשי (טופס 102)
  | "registrar_fee" // אגרה שנתית לרשם
  | "renewal" // חידוש ביטוח/רישיון
  | "document_expiry"; // תפוגת מסמך

/** Where a date comes from — drives how hard we press on it. */
export type ObligationBasis =
  | "statutory" // a real filing deadline with legal consequence (penalties)
  | "renewal"; // a real date from the user's own data (policy/licence/doc)

export type VatFrequency = "monthly" | "bimonthly";

export interface Obligation {
  id: string; // stable per occurrence, for dedupe/UI keys
  kind: ObligationKind;
  basis: ObligationBasis;
  title: string;
  dueDate: string; // ISO date
  templateId: string | null;
  /** Days from `today` (negative = overdue). */
  daysUntil: number;
  /** The reporting period this filing covers, e.g. "יולי–אוגוסט 2026". */
  periodLabel: string | null;
  /** Plain-Hebrew explanation of why this is the date — shown as "למה התאריך הזה?". */
  ruleText: string;
  /** Official source backing the rule. */
  sourceUrl: string | null;
}

export interface ComplianceTask {
  template_id: string;
  status: string;
  is_relevant: boolean;
  /** not_applicable / handled_externally. null on rows predating the split. */
  dismissal?: Dismissal | null;
  completion_data?: Record<string, string> | null;
}

export interface ComplianceDocument {
  name: string;
  expires_at: string | null;
}

/** The few real facts that change the dates — kept tiny on purpose. */
export interface ComplianceProfile {
  entityType?: string;
  vatFrequency?: VatFrequency;
  /** With accountant representation the annual report gets an extension. */
  hasAccountant?: boolean;
}

// ---------- date helpers ----------

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, today: Date): number {
  const from = new Date(fromIso + "T00:00:00Z");
  const todayMid = new Date(todayInIsrael(today) + "T00:00:00Z");
  return Math.round((from.getTime() - todayMid.getTime()) / 86_400_000);
}

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

/** dd.mm.yyyy for a rule sentence. */
function heDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

/** "יולי–אוגוסט 2026" or "יולי 2026" when the period is a single month. */
function periodLabelFor(startAbs: number, endAbs: number): string {
  const sY = Math.floor(startAbs / 12);
  const sM = startAbs % 12;
  const eY = Math.floor(endAbs / 12);
  const eM = endAbs % 12;
  if (startAbs === endAbs) return `${HE_MONTHS[sM]} ${sY}`;
  const sameYear = sY === eY;
  return sameYear
    ? `${HE_MONTHS[sM]}–${HE_MONTHS[eM]} ${eY}`
    : `${HE_MONTHS[sM]} ${sY} – ${HE_MONTHS[eM]} ${eY}`;
}

// ---------- statutory filing calendar ----------

/**
 * The three filings that carry a real, dated legal deadline with penalties.
 * These are the only obligations that may ever show as "overdue".
 */
/**
 * Derived from the date-rule registry rather than hand-written, so the set of
 * things that may show as "overdue" can never drift from the set of things we
 * can actually date. It used to be typed out twice — here and in
 * gamification.ts — which was a correctness risk, not just duplication.
 *
 * on_demand rules are excluded on purpose: we cannot see the demand, so calling
 * one late would be a fabricated deadline.
 */
export const STATUTORY_FILINGS = new Set(DATED_FILING_IDS);

export function isStatutoryFiling(templateId: string): boolean {
  return STATUTORY_FILINGS.has(templateId);
}

/** VAT & advances share the business's reporting frequency (default bimonthly). */
function reportingFrequency(profile: ComplianceProfile): VatFrequency {
  return profile.vatFrequency ?? "bimonthly";
}

interface FilingPeriod {
  startAbs: number; // absolute month index (year*12 + month)
  endAbs: number;
  dueIso: string; // 15th of the month AFTER the period end
}

/**
 * The next VAT/advances filing whose deadline has NOT yet passed.
 * Israeli periods are fixed calendar months (monthly) or calendar bimonths
 * (Jan–Feb, Mar–Apr, …), filed by the 15th of the following month.
 */
export function nextFilingPeriod(
  today: Date,
  frequency: VatFrequency
): FilingPeriod {
  const step = frequency === "monthly" ? 1 : 2;
  const nowParts = israelParts(today);
  const tAbs = nowParts.year * 12 + nowParts.month;
  // scan from a couple of periods back so we catch a period that's still open
  for (let endAbs = tAbs - 2 * step; endAbs <= tAbs + 12; endAbs++) {
    // bimonthly periods end on an odd calendar month (Feb=1, Apr=3, …)
    if (frequency === "bimonthly" && endAbs % 2 !== 1) continue;
    const dueY = Math.floor((endAbs + 1) / 12);
    const dueM = (endAbs + 1) % 12;
    const dueIso = iso(new Date(Date.UTC(dueY, dueM, 15)));
    if (daysBetween(dueIso, today) >= 0) {
      return { startAbs: endAbs - (step - 1), endAbs, dueIso };
    }
  }
  // unreachable in practice; fall back to this month's 15th
  const y = nowParts.year;
  const m = nowParts.month;
  return { startAbs: tAbs, endAbs: tAbs, dueIso: iso(new Date(Date.UTC(y, m, 15))) };
}

/** Next April 30 (annual report anchor). */
export function nextAnnualReport(today: Date): string {
  const y = israelParts(today).year;
  let due = new Date(Date.UTC(y, 3, 30)); // April = month 3
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y + 1, 3, 30));
  return iso(due);
}

const ITA_SOURCE = "https://www.gov.il/he/departments/israel_tax_authority";

/** Next occurrence of a fixed calendar date (month is 1-12). */
export function nextAnnualDate(today: Date, month: number, day: number): string {
  const y = israelParts(today).year;
  let due = new Date(Date.UTC(y, month - 1, day));
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y + 1, month - 1, day));
  return iso(due);
}

/**
 * Next occurrence of "day N of every month, covering the previous month".
 * Returns the period too, because the answer to "which month is this for?" is
 * part of the date being trustworthy.
 */
export function nextMonthlyDue(
  today: Date,
  day: number
): { dueIso: string; periodAbs: number } {
  const { year, month } = israelParts(today);
  const tAbs = year * 12 + month;
  // start a month back so a period whose deadline has not yet passed is caught
  for (let dueAbs = tAbs - 1; dueAbs <= tAbs + 13; dueAbs++) {
    const dueIso = iso(new Date(Date.UTC(Math.floor(dueAbs / 12), dueAbs % 12, day)));
    if (daysBetween(dueIso, today) >= 0) return { dueIso, periodAbs: dueAbs - 1 };
  }
  const dueIso = iso(new Date(Date.UTC(year, month, day)));
  return { dueIso, periodAbs: tAbs - 1 };
}

/**
 * The next due date for a dated statutory filing, from its declared rule.
 *
 * Returns null for an on_demand obligation: there is genuinely no date until
 * the user tells us when the demand arrived, and returning a guess would be the
 * fabricated-deadline bug in a new costume.
 */
export function nextStatutoryDueDate(
  templateId: string,
  today: Date,
  profile: ComplianceProfile
): string | null {
  const entry = filingRuleFor(templateId);
  if (!entry) return null;
  switch (entry.rule.anchor) {
    case "period_plus":
      return nextFilingPeriod(today, reportingFrequency(profile)).dueIso;
    case "monthly":
      return nextMonthlyDue(today, entry.rule.day).dueIso;
    case "annual": {
      const statutoryIso = nextAnnualDate(today, entry.rule.month, entry.rule.day);
      const forYear =
        entry.kind === "registrar_fee"
          ? Number(statutoryIso.slice(0, 4))
          : Number(statutoryIso.slice(0, 4)) - 1;
      const published = nextAnnouncedFiling(entry.rule, iso(today));
      const announced = published?.dueIso ?? announcedDateFor(entry.rule, forYear);
      // Same precedence as occurrenceFor, so the reminder sweep and the
      // calendar can never disagree about one filing.
      if (!announced && entry.rule.announcedOnly) return null;
      return announced ?? statutoryIso;
    }
    case "on_demand":
      return null;
  }
}

// ---------- recommended (non-statutory) deadlines ----------

/**
 * One-off setup tasks (open your files, get insurance, …) have NO statutory
 * date. We anchor a *recommendation* to when the business started — honest
 * framing the user asked for: a suggestion, never a red "overdue".
 */
export function recommendedDeadline(
  template: TaskTemplate,
  registrationDate: string | null
): string | null {
  if (template.deadline_days == null) return null;
  if (isStatutoryFiling(template.id)) return null;
  const base = registrationDate
    ? new Date(registrationDate + "T00:00:00Z")
    : new Date();
  base.setUTCDate(base.getUTCDate() + template.deadline_days);
  return iso(base);
}

/**
 * One occurrence of a declared filing rule: the date, the period it covers, and
 * the sentence explaining it.
 *
 * The explanation is generated FROM the rule rather than written beside it. That
 * is deliberate: the old hand-written strings had drifted from their own dates —
 * the VAT text promised "מקוון — עד ה-19" next to a date computed for the 15th,
 * and the annual-report text said "עד סוף מאי" next to 30 April. An explanation
 * that contradicts its date is worse than none, because the product's entire
 * claim is that you can see the reasoning behind the date.
 */
function occurrenceFor(
  entry: FilingRule,
  today: Date,
  freq: VatFrequency,
  profile: ComplianceProfile
): { dueIso: string; periodLabel: string | null; ruleText: string } | null {
  const freqWord = freq === "monthly" ? "כל חודש" : "אחת לחודשיים";
  const note = entry.note ? ` ${entry.note}` : "";

  switch (entry.rule.anchor) {
    case "period_plus": {
      const period = nextFilingPeriod(today, freq);
      const label = periodLabelFor(period.startAbs, period.endAbs);
      return {
        dueIso: period.dueIso,
        periodLabel: label,
        ruleText:
          `הדיווח מוגש ${freqWord}, עד ה-${entry.rule.day} בחודש שאחרי סוף התקופה. ` +
          `${entry.periodNoun} ${label} מוגשת עד ${heDate(period.dueIso)}.${note}`,
      };
    }
    case "monthly": {
      const { dueIso, periodAbs } = nextMonthlyDue(today, entry.rule.day);
      const label = periodLabelFor(periodAbs, periodAbs);
      return {
        dueIso,
        periodLabel: label,
        ruleText:
          `מדי חודש, עד ה-${entry.rule.day} בחודש, עבור החודש שקדם לו. ` +
          `${entry.periodNoun} ${label} — עד ${heDate(dueIso)}.${note}`,
      };
    }
    case "annual": {
      const statutoryIso = nextAnnualDate(today, entry.rule.month, entry.rule.day);
      // A registrar fee is FOR the year it falls in; a return is for the year
      // that just ended.
      const forYear =
        entry.kind === "registrar_fee"
          ? Number(statutoryIso.slice(0, 4))
          : Number(statutoryIso.slice(0, 4)) - 1;

      // Where the authority publishes the date per tax year, that date wins.
      // Read from the published map rather than derived from the calendar: the
      // statutory base rolls forward once it passes, which shifts the derived
      // year by one, so on 1 May 2026 a calendar derivation lands on tax year
      // 2026 when the return actually open is 2025.
      const published = nextAnnouncedFiling(entry.rule, iso(today));
      const announced = published?.dueIso ?? announcedDateFor(entry.rule, forYear);

      if (!announced && entry.rule.announcedOnly) {
        // No published date for this year, and no honest way to derive one.
        // Returning null means the task explains the rule and shows no
        // deadline — an invented date on the largest penalty exposure in the
        // product is worse than admitting we do not have it yet.
        return null;
      }

      const dueIso = announced ?? statutoryIso;
      const coveredYear = published?.taxYear ?? forYear;

      // The annual tax return is the one place a real, widely-used extension
      // exists, and it depends on being represented. Say that instead of
      // asserting a single date for everyone.
      const representedNote =
        entry.kind === "annual_report" && profile.hasAccountant
          ? ' בייצוג של רו"ח או יועץ מס מקבלים בדרך כלל ארכה לפי מועדי ה"הסדר" של רשות המסים — ודאו את התאריך המדויק מול המייצג.'
          : "";

      return {
        dueIso,
        periodLabel: `${entry.periodNoun} ${coveredYear}`,
        ruleText: announced
          ? `רשות המסים פרסמה לשנת המס ${coveredYear} מועד הגשה עד ${heDate(dueIso)}.` +
            `${note}${representedNote}`
          : `מועד קבוע בלוח השנה: ${heDate(dueIso)} (${entry.rule.day} ב${HE_MONTHS[entry.rule.month - 1]}).` +
            `${note}${representedNote}`,
      };
    }
    case "on_demand":
      // No demand date, no deadline. The rule is explained on the task itself;
      // inventing a date here is precisely the bug this pass removed.
      return null;
  }
}

// ---------- main engine ----------

/** Reads a yyyy-mm-dd out of a completion field if present. */
function renewalDate(task: ComplianceTask): string | null {
  const raw = task.completion_data?.renewal;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : iso(d);
}

export function computeUpcomingObligations(
  tasks: ComplianceTask[],
  templates: Map<string, TaskTemplate>,
  documents: ComplianceDocument[],
  today: Date = new Date(),
  profile: ComplianceProfile = {},
  horizonDays = 400
): Obligation[] {
  const out: Obligation[] = [];
  const freq = reportingFrequency(profile);
  const freqWord = freq === "monthly" ? "כל חודש" : "אחת לחודשיים";
  const withinHorizon = (dueIso: string) => {
    const d = daysBetween(dueIso, today);
    return d >= -60 && d <= horizonDays; // keep a little overdue history visible
  };

  // One truth: a statutory filing obligation is real only once its prerequisites
  // are done. You have no VAT/advances/annual duty before the tax file is even
  // opened, so those dates never appear (as pressing or on the calendar) until
  // the setup task that unlocks them is complete.
  const taskById = new Map(tasks.map((t) => [t.template_id, t] as const));
  // Everything here is a statutory filing, so a bare "not relevant" on the
  // unlocking setup task does NOT open the gate: a user's view that opening a
  // VAT file does not apply to them cannot be what starts a penalty-bearing VAT
  // duty running. satisfiesDependency owns that rule for every engine.
  const prereqsMet = (template: TaskTemplate) =>
    template.depends_on.every((dep) => {
      const dt = taskById.get(dep);
      return satisfiesDependency(
        dt && { status: dt.status as TaskStatus, is_relevant: dt.is_relevant, dismissal: dt.dismissal },
        { statutory: true }
      );
    });

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;
    // statutory filings wait for their unlocking setup task
    if (isStatutoryFiling(task.template_id) && !prereqsMet(template)) continue;

    // --- statutory filings: real, period-accurate, sourced dates ---
    // Driven entirely by the declared rule. This used to be three hardcoded
    // `if (task.template_id === ...)` branches, which is why only three
    // obligations had dates while the registrar fees, every employer filing and
    // the self-employed national-insurance advance had none.
    const entry = filingRuleFor(task.template_id);
    if (entry) {
      const occurrence = occurrenceFor(entry, today, freq, profile);
      if (occurrence && withinHorizon(occurrence.dueIso)) {
        out.push({
          id: `${entry.kind}:${task.template_id}:${occurrence.dueIso}`,
          kind: entry.kind,
          basis: "statutory",
          title: template.title,
          dueDate: occurrence.dueIso,
          templateId: template.id,
          daysUntil: daysBetween(occurrence.dueIso, today),
          periodLabel: occurrence.periodLabel,
          ruleText: occurrence.ruleText,
          sourceUrl: entry.source,
        });
      }
      continue;
    }

    // --- renewals captured at completion (insurance / licence) ---
    const renewal = renewalDate(task);
    if (renewal && withinHorizon(renewal)) {
      out.push({
        id: `renewal:${template.id}:${renewal}`,
        kind: "renewal",
        basis: "renewal",
        title: `חידוש: ${template.title}`,
        dueDate: renewal,
        templateId: template.id,
        daysUntil: daysBetween(renewal, today),
        periodLabel: null,
        ruleText: `תאריך החידוש שהזנתם בעת סיום המשימה. כדאי לטפל בחידוש עוד לפני מועד זה כדי לא להישאר ללא כיסוי.`,
        sourceUrl: null,
      });
    }
  }

  // --- document expiries ---
  for (const doc of documents) {
    if (!doc.expires_at) continue;
    if (!withinHorizon(doc.expires_at)) continue;
    out.push({
      id: `doc:${doc.name}:${doc.expires_at}`,
      kind: "document_expiry",
      basis: "renewal",
      title: `תפוגת מסמך: ${doc.name}`,
      dueDate: doc.expires_at,
      templateId: null,
      daysUntil: daysBetween(doc.expires_at, today),
      periodLabel: null,
      ruleText: `מועד התפוגה שרשום על המסמך שהעליתם. חדשו אותו לפני התאריך כדי לשמור על תוקף.`,
      sourceUrl: null,
    });
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Escalating reminder windows. Free plan only gets the 7-day nudge; Pro gets
 * the full runway so nothing is ever a surprise.
 */
export const REMINDER_WINDOWS_FREE = [7] as const;
export const REMINDER_WINDOWS_PRO = [30, 14, 7, 1] as const;

/** Which windows (in days-before) have been crossed for a due date today. */
export function crossedWindows(
  daysUntil: number,
  windows: readonly number[]
): number[] {
  if (daysUntil < 0) return []; // overdue handled separately
  return windows.filter((w) => daysUntil <= w);
}

/**
 * A statutory filing whose date cannot be computed because the user set its
 * prerequisite aside — not because the prerequisite is merely unfinished.
 *
 * That distinction is the point. A brand-new עוסק who has not yet opened a VAT
 * file SHOULD see no VAT deadlines: the duty does not exist yet, and saying so
 * is the honest-deadline principle working. But a user who dismissed "open a VAT
 * file" as not applicable has made a claim the product cannot verify, and
 * silently withholding the filing dates that depend on it would replace a
 * fabricated deadline with a missing one — the same failure in the other
 * direction, which is exactly what this pass exists to stop.
 *
 * So these are surfaced and named, with the prerequisite that caused it.
 */
export interface BlockedFiling {
  templateId: string;
  /** The prerequisite the user dismissed. */
  blockedBy: string;
  /** Which kind of dismissal it was. */
  dismissal: Dismissal;
}

export function filingsBlockedByDismissal(
  tasks: ComplianceTask[],
  templates: Map<string, TaskTemplate>
): BlockedFiling[] {
  const taskById = new Map(tasks.map((t) => [t.template_id, t] as const));
  const out: BlockedFiling[] = [];

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    if (!isStatutoryFiling(task.template_id)) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    for (const dep of template.depends_on) {
      const dt = taskById.get(dep);
      // Absent from the plan is the alternative-prerequisite convention, not a
      // block. Only a dismissal that fails the statutory gate lands here.
      if (!dt || !dt.is_relevant) continue;
      const dismissal = dismissalOf({
        status: dt.status as TaskStatus,
        is_relevant: dt.is_relevant,
        dismissal: dt.dismissal,
      });
      if (dismissal !== "not_applicable") continue;
      if (satisfiesDependency(
        { status: dt.status as TaskStatus, is_relevant: dt.is_relevant, dismissal: dt.dismissal },
        { statutory: true }
      )) continue;
      out.push({ templateId: task.template_id, blockedBy: dep, dismissal });
    }
  }
  return out;
}
