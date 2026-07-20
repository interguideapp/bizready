import type { TaskTemplate } from "@/lib/types";

/**
 * The Compliance Guardian's calendar engine.
 *
 * Turns the business's recurring obligations, insurance renewals and document
 * expiries into concrete, calendar-anchored upcoming due dates — the thing that
 * makes "never miss a filing" real rather than a drifting "+30 days".
 *
 * Pure & tested. Dates are computed against real Israeli anchors where they are
 * well-known (VAT / advances by the 15th of the following month, annual report
 * by April 30). Softer obligations fall back to month-end.
 */

export type ObligationKind =
  | "vat" // דיווח מע"מ
  | "advances" // מקדמות מס
  | "annual_report" // דוח שנתי
  | "recurring" // משימה מחזורית אחרת
  | "renewal" // חידוש ביטוח/רישיון
  | "document_expiry"; // תפוגת מסמך

export interface Obligation {
  id: string; // stable per occurrence, for dedupe/UI keys
  kind: ObligationKind;
  title: string;
  dueDate: string; // ISO date
  templateId: string | null;
  /** Days from `today` (negative = overdue). */
  daysUntil: number;
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

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, today: Date): number {
  const from = new Date(fromIso + "T00:00:00Z");
  const todayMid = new Date(iso(today) + "T00:00:00Z");
  return Math.round((from.getTime() - todayMid.getTime()) / 86_400_000);
}

/** The 15th of `monthsAhead` months from a base month (VAT/advances anchor). */
function fifteenthOfFollowingMonth(today: Date): string {
  // reporting deadline is the 15th of the month after the period; if this
  // month's 15th already passed, roll to next month.
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  let due = new Date(Date.UTC(y, m, 15));
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y, m + 1, 15));
  return iso(due);
}

/** Next April 30 (annual report anchor). */
function nextAnnualReport(today: Date): string {
  const y = today.getUTCFullYear();
  let due = new Date(Date.UTC(y, 3, 30)); // April = month 3
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y + 1, 3, 30));
  return iso(due);
}

/** Last day of the current (or next, if today is the last day) month. */
function nextMonthEnd(today: Date): string {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  let due = new Date(Date.UTC(y, m + 1, 0)); // day 0 of next month = last of this
  if (daysBetween(iso(due), today) < 0) due = new Date(Date.UTC(y, m + 2, 0));
  return iso(due);
}

const ANCHORED: Record<string, (t: Date) => string> = {
  "vat-reporting": fifteenthOfFollowingMonth,
  "income-tax-advances": fifteenthOfFollowingMonth,
  "annual-tax-report": nextAnnualReport,
};

const KIND_BY_TEMPLATE: Record<string, ObligationKind> = {
  "vat-reporting": "vat",
  "income-tax-advances": "advances",
  "annual-tax-report": "annual_report",
};

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
  horizonDays = 400
): Obligation[] {
  const out: Obligation[] = [];
  const withinHorizon = (dueIso: string) => {
    const d = daysBetween(dueIso, today);
    return d >= -60 && d <= horizonDays; // show a little overdue history too
  };

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    // recurring obligations → concrete next date.
    // Yearly-but-unanchored tasks (insurance/licences) are renewal-type: they
    // surface via their renewal date / document expiry, not a generic month-end.
    const isAnchored = template.id in ANCHORED;
    const isPeriodic =
      template.recurrence === "monthly" || template.recurrence === "bimonthly";
    if (template.recurrence && (isAnchored || isPeriodic)) {
      const anchor = ANCHORED[template.id] ?? nextMonthEnd;
      const dueDate = anchor(today);
      if (withinHorizon(dueDate)) {
        out.push({
          id: `${template.id}:${dueDate}`,
          kind: KIND_BY_TEMPLATE[template.id] ?? "recurring",
          title: template.title,
          dueDate,
          templateId: template.id,
          daysUntil: daysBetween(dueDate, today),
        });
      }
    }

    // yearly insurance/licence renewal captured at completion
    const renewal = renewalDate(task);
    if (renewal && withinHorizon(renewal)) {
      out.push({
        id: `renewal:${template.id}:${renewal}`,
        kind: "renewal",
        title: `חידוש: ${template.title}`,
        dueDate: renewal,
        templateId: template.id,
        daysUntil: daysBetween(renewal, today),
      });
    }
  }

  // document expiries
  for (const doc of documents) {
    if (!doc.expires_at) continue;
    if (!withinHorizon(doc.expires_at)) continue;
    out.push({
      id: `doc:${doc.name}:${doc.expires_at}`,
      kind: "document_expiry",
      title: `תפוגת מסמך: ${doc.name}`,
      dueDate: doc.expires_at,
      templateId: null,
      daysUntil: daysBetween(doc.expires_at, today),
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
