/**
 * The confidence layer — the plain-language "האם אני תקין?" answer a new business
 * owner actually wants, instead of a bare score. Pure & tested. It derives from
 * the same truth the rest of the app uses (overdue statutory filings = real risk;
 * the attention engine's urgent/next item = the one thing to do), so it never
 * invents a second opinion.
 */

export type ConfidenceState = "at_risk" | "on_track" | "covered";

export interface ConfidenceInput {
  /** Overdue statutory filings — the only thing that is a genuine risk. */
  overdueStatutory: number;
  /** The single most pressing dated, actionable item (from computeAttention). */
  urgent: { templateId: string | null; title: string; daysUntil: number } | null;
  /** The most important available next task (from computeAttention). */
  next: { templateId: string; title: string } | null;
  /** Relevant critical tasks not yet done — used to tell "covered" from "on track". */
  remainingCritical: number;
  /**
   * עוסק-פטור ceiling usage as a percentage of the annual ceiling (from logged/
   * synced income). Only pass for an osek_patur; omit otherwise. ≥100 means the
   * ceiling was crossed (a genuine risk); 80–99 is an approaching-limit heads-up.
   */
  ceilingPct?: number;
  /** Task to open for the ceiling action (e.g. patur-ceiling-watch), when in plan. */
  ceilingTaskId?: string | null;
}

export interface Confidence {
  state: ConfidenceState;
  /** One-line status, e.g. "העסק שלך במסלול תקין". */
  headline: string;
  /** Supporting line naming the concrete next move or the reassurance. */
  detail: string;
  /** What to click — the one thing that matters now (null when fully covered). */
  theOneThing: { templateId: string; title: string } | null;
  /** Genuine risks (overdue statutory) — drives the alarm styling. */
  realRisks: number;
}

function daysPhrase(daysUntil: number): string {
  if (daysUntil < 0) return "עבר המועד";
  if (daysUntil === 0) return "היום";
  if (daysUntil === 1) return "מחר";
  return `בעוד ${daysUntil} ימים`;
}

export function computeConfidence(input: ConfidenceInput): Confidence {
  const { overdueStatutory, urgent, next, remainingCritical, ceilingPct, ceilingTaskId } = input;
  const nearCeiling = ceilingPct != null && ceilingPct >= 80 && ceilingPct < 100;
  const ceilingNote = nearCeiling ? ` · מתקרבים לתקרת הפטור (${Math.round(ceilingPct!)}%)` : "";

  // 1. real risk — overdue statutory filings alarm honestly
  if (overdueStatutory > 0) {
    const one = urgent ?? (next ? { templateId: next.templateId, title: next.title, daysUntil: -1 } : null);
    return {
      state: "at_risk",
      headline:
        overdueStatutory === 1 ? "יש חוב אחד באיחור" : `יש ${overdueStatutory} חובות באיחור`,
      detail: (one ? `הכי דחוף: ${one.title} — כדאי לטפל היום` : "כדאי לטפל בזה היום") + ceilingNote,
      theOneThing: one ? { templateId: one.templateId ?? "calendar", title: one.title } : null,
      realRisks: overdueStatutory,
    };
  }

  // 1b. real risk — the עוסק-פטור ceiling was crossed (retroactive VAT exposure)
  if (ceilingPct != null && ceilingPct >= 100) {
    return {
      state: "at_risk",
      headline: "חצית את תקרת עוסק פטור",
      detail: "זמן לעבור לעוסק מורשה — מעל התקרה חל חיוב מע\"מ. כדאי להסדיר בהקדם.",
      theOneThing: ceilingTaskId ? { templateId: ceilingTaskId, title: "מעבר לעוסק מורשה" } : null,
      realRisks: 1,
    };
  }

  // 2. on track — nothing overdue, but there's a clear next move
  if (urgent) {
    return {
      state: "on_track",
      headline: "העסק שלך במסלול תקין",
      detail: `הצעד הבא: ${urgent.title} · ${daysPhrase(urgent.daysUntil)}` + ceilingNote,
      theOneThing: { templateId: urgent.templateId ?? "calendar", title: urgent.title },
      realRisks: 0,
    };
  }
  if (next) {
    return {
      state: "on_track",
      headline: "העסק שלך במסלול תקין",
      detail: `הצעד הבא: ${next.title}` + ceilingNote,
      theOneThing: { templateId: next.templateId, title: next.title },
      realRisks: 0,
    };
  }

  // 3. covered — no risks, nothing pressing, no open critical work
  if (remainingCritical === 0) {
    return {
      state: nearCeiling ? "on_track" : "covered",
      headline: nearCeiling ? "העסק שלך במסלול תקין" : "העסק שלך מסודר ותקין",
      detail: nearCeiling
        ? `הכול מסודר${ceilingNote} — כדאי להתחיל לתכנן מעבר לעוסק מורשה`
        : "אין כרגע חובות פתוחות או מועדים דחופים — כל הכבוד",
      theOneThing: nearCeiling && ceilingTaskId ? { templateId: ceilingTaskId, title: "מעקב תקרת עוסק פטור" } : null,
      realRisks: 0,
    };
  }

  // fallback: critical work remains but nothing is dated/urgent yet
  return {
    state: "on_track",
    headline: "העסק שלך במסלול תקין",
    detail: "יש עוד כמה משימות חשובות להשלים" + ceilingNote,
    theOneThing: null,
    realRisks: 0,
  };
}
