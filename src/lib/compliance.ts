import type { TaskTemplate } from "@/lib/types";

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
  | "advances" // מקדמות מס
  | "annual_report" // דוח שנתי
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
  const todayMid = new Date(iso(today) + "T00:00:00Z");
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
export const STATUTORY_FILINGS = new Set([
  "vat-reporting",
  "income-tax-advances",
  "annual-tax-report",
]);

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
  const tAbs = today.getUTCFullYear() * 12 + today.getUTCMonth();
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
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return { startAbs: tAbs, endAbs: tAbs, dueIso: iso(new Date(Date.UTC(y, m, 15))) };
}

/** Next April 30 (annual report anchor). */
export function nextAnnualReport(today: Date): string {
  const y = today.getUTCFullYear();
  let due = new Date(Date.UTC(y, 3, 30)); // April = month 3
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y + 1, 3, 30));
  return iso(due);
}

const ITA_SOURCE = "https://www.gov.il/he/departments/israel_tax_authority";

/** The next due date for a statutory filing template — anchored, frequency-aware. */
export function nextStatutoryDueDate(
  templateId: string,
  today: Date,
  profile: ComplianceProfile
): string {
  if (templateId === "annual-tax-report") return nextAnnualReport(today);
  return nextFilingPeriod(today, reportingFrequency(profile)).dueIso;
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

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    // --- statutory filings: real, period-accurate, sourced dates ---
    if (task.template_id === "vat-reporting") {
      const p = nextFilingPeriod(today, freq);
      if (withinHorizon(p.dueIso)) {
        const label = periodLabelFor(p.startAbs, p.endAbs);
        out.push({
          id: `vat:${p.dueIso}`,
          kind: "vat",
          basis: "statutory",
          title: template.title,
          dueDate: p.dueIso,
          templateId: template.id,
          daysUntil: daysBetween(p.dueIso, today),
          periodLabel: label,
          ruleText: `דיווח מע"מ מוגש ${freqWord}, עד ה-15 בחודש שאחרי סוף התקופה (בדיווח ותשלום מקוונים — עד ה-19). התקופה ${label} מוגשת עד ${heDate(p.dueIso)}.`,
          sourceUrl: ITA_SOURCE,
        });
      }
      continue;
    }

    if (task.template_id === "income-tax-advances") {
      const p = nextFilingPeriod(today, freq);
      if (withinHorizon(p.dueIso)) {
        const label = periodLabelFor(p.startAbs, p.endAbs);
        out.push({
          id: `advances:${p.dueIso}`,
          kind: "advances",
          basis: "statutory",
          title: template.title,
          dueDate: p.dueIso,
          templateId: template.id,
          daysUntil: daysBetween(p.dueIso, today),
          periodLabel: label,
          ruleText: `מקדמות מס הכנסה משולמות באותה תדירות כמו המע"מ (${freqWord}), עד ה-15 בחודש העוקב. עבור ${label} — עד ${heDate(p.dueIso)}.`,
          sourceUrl: ITA_SOURCE,
        });
      }
      continue;
    }

    if (task.template_id === "annual-tax-report") {
      const dueIso = nextAnnualReport(today);
      if (withinHorizon(dueIso)) {
        out.push({
          id: `annual:${dueIso}`,
          kind: "annual_report",
          basis: "statutory",
          title: template.title,
          dueDate: dueIso,
          templateId: template.id,
          daysUntil: daysBetween(dueIso, today),
          periodLabel: `שנת ${Number(dueIso.slice(0, 4)) - 1}`,
          ruleText: profile.hasAccountant
            ? `הדוח השנתי מוגש עד 30 באפריל. עם ייצוג של רו"ח מקבלים בדרך כלל ארכה (מועדי ה"הסדר" של רשות המסים) — ודאו את התאריך המדויק מול הרו"ח.`
            : `הדוח השנתי לעצמאי מוגש עד 30 באפריל בשנה העוקבת (בהגשה מקוונת — לרוב עד סוף מאי).`,
          sourceUrl: ITA_SOURCE,
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
