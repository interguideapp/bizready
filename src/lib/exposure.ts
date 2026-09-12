import { legalBasisOf } from "@/lib/content/legal-basis";
import { filingRuleFor } from "@/lib/content/filing-rules";
import type { Obligation } from "@/lib/compliance";

/**
 * What is it actually going to cost you if you do nothing?
 *
 * The readiness score is a weighted completion percentage, and `confidence.ts`
 * is a three-state label. Neither knows anything about consequence. So a missed
 * VAT filing — which accrues an automatic penalty plus interest from day one —
 * and a missing WhatsApp Business profile both moved one percentage bar, and the
 * home screen ranked them by how soon they were due rather than by what they do
 * to you.
 *
 * Exposure is severity x proximity x certainty:
 *
 *   severity   what the consequence IS, from the legal basis and the kind of
 *              obligation. Not hand-assigned per task.
 *   proximity  how close the deadline is, and how far past it. Overdue is not
 *              "very soon" — it is a different state, because the penalty has
 *              already started.
 *   certainty  how sure we are the duty applies at all. A recommendation we
 *              inferred should not outrank a statute we can cite.
 *
 * The point of the model is the RANKING, not the number. The number exists so
 * the ranking is explainable and testable; it is never shown as a score,
 * because a "risk score of 47" is exactly the meaningless metric this replaces.
 */

export type Severity = "penalty_accruing" | "penalty_fixed" | "blocking" | "advisory";

export interface Exposure {
  obligationId: string;
  templateId: string | null;
  title: string;
  dueDate: string;
  daysUntil: number;
  /**
   * Statutory or not, carried through so a surface can word a passed date
   * correctly. "באיחור" is a claim that a deadline was missed — true of a VAT
   * period, false of an insurance policy that simply ran out.
   */
  basis: "statutory" | "renewal";
  severity: Severity;
  /** 0-1. Higher = sooner or longer overdue. */
  proximity: number;
  /** 0-1. How confident we are the duty applies. */
  certainty: number;
  /** severity x proximity x certainty. For ordering, never for display. */
  score: number;
  /** Plain Hebrew: what happens if this is ignored. Sourced from the basis. */
  consequence: string;
}

/**
 * Severity weights.
 *
 * The gap between an accruing penalty and a fixed one is deliberate and large:
 * interest that compounds daily is a different kind of problem from a one-off
 * fee, and a model that scored them similarly would rank them similarly.
 */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  penalty_accruing: 1,
  penalty_fixed: 0.6,
  blocking: 0.45,
  advisory: 0.15,
};

/** What ignoring it actually does, in words the user can act on. */
const CONSEQUENCE: Record<Severity, string> = {
  penalty_accruing:
    "איחור מתחיל לצבור קנס וריבית מהיום הראשון, והחוב גדל כל עוד לא מדווחים.",
  penalty_fixed:
    "אחרי המועד התעריף עולה או נוסף קנס חד-פעמי. זה לא גדל מעצמו, אבל הוא לא מתבטל.",
  blocking:
    "בלי זה אי אפשר להתקדם: חובות אחרות תלויות בו, או שהפעילות עצמה לא מוסדרת.",
  advisory: "אין קנס. זו חשיפה עסקית — מה שעלול לעלות לכם אם משהו ילך לא טוב.",
};

/**
 * Classifies an obligation's severity from what it IS, not from a hand-assigned
 * number.
 *
 * Deriving it means a new filing gets a correct severity by declaring its rule
 * and its legal basis, rather than by someone remembering to rate it — which is
 * how 40% of templates ended up `critical`.
 */
export function severityOf(obligation: Obligation): Severity {
  const templateId = obligation.templateId;
  const basis = templateId ? legalBasisOf(templateId) : "best_practice";

  if (basis !== "statute") return "advisory";

  // A periodic filing is the accruing case: Israeli VAT and advances attract a
  // late-filing penalty plus linkage and interest that grow with the delay.
  if (obligation.kind === "vat" || obligation.kind === "advances") {
    return "penalty_accruing";
  }
  if (obligation.kind === "employer_deductions") return "penalty_accruing";

  // The registrar fee is the clearest fixed-step case in the product: it
  // changes to a higher tariff on 1 April and then stops changing.
  if (obligation.kind === "registrar_fee") return "penalty_fixed";

  if (obligation.kind === "annual_report") return "penalty_accruing";

  // A renewal or expiry that gates something else — a licence, an insurance
  // certificate — blocks rather than fines.
  if (obligation.kind === "renewal" || obligation.kind === "document_expiry") {
    return "blocking";
  }

  return "penalty_fixed";
}

/**
 * Proximity, 0-1.
 *
 * Overdue is NOT modelled as "extremely soon". It gets its own band above
 * everything upcoming, because the consequence has already begun — and it grows
 * with the delay, since that is what an accruing penalty does. Anything beyond
 * roughly a quarter away contributes almost nothing, so a distant annual return
 * cannot crowd out something due next week.
 */
export function proximityOf(daysUntil: number): number {
  if (daysUntil < 0) {
    const daysLate = -daysUntil;
    // 0.8 at one day late, approaching 1 as it drags on.
    return Math.min(1, 0.8 + Math.min(0.2, (daysLate / 90) * 0.2));
  }
  if (daysUntil === 0) return 0.75;
  if (daysUntil <= 7) return 0.6;
  if (daysUntil <= 14) return 0.45;
  if (daysUntil <= 30) return 0.3;
  if (daysUntil <= 90) return 0.15;
  return 0.05;
}

/**
 * Certainty, 0-1.
 *
 * A duty whose date we computed from a declared, sourced rule is one we can
 * stand behind. A recommended date derived from "+N days from when the plan was
 * built" is a suggestion, and must not outrank a citable statute just because it
 * happens to be nearer.
 */
export function certaintyOf(obligation: Obligation): number {
  if (obligation.basis !== "statutory") return 0.4;
  const rule = obligation.templateId ? filingRuleFor(obligation.templateId) : null;
  // Sourced rule + a citation on the obligation itself.
  if (rule && obligation.sourceUrl) return 1;
  if (rule) return 0.85;
  return 0.6;
}

/** Scores one obligation. */
export function exposureOf(obligation: Obligation): Exposure {
  const severity = severityOf(obligation);
  const proximity = proximityOf(obligation.daysUntil);
  const certainty = certaintyOf(obligation);

  return {
    obligationId: obligation.id,
    templateId: obligation.templateId,
    title: obligation.title,
    dueDate: obligation.dueDate,
    daysUntil: obligation.daysUntil,
    basis: obligation.basis,
    severity,
    proximity,
    certainty,
    score: SEVERITY_WEIGHT[severity] * proximity * certainty,
    consequence: CONSEQUENCE[severity],
  };
}

/**
 * Ranks obligations by what they will actually cost, worst first.
 *
 * Ties break on the earlier due date, so the ordering is stable and never
 * depends on the order obligations happened to arrive in.
 */
export function rankByExposure(obligations: Obligation[]): Exposure[] {
  return obligations
    .map(exposureOf)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.obligationId.localeCompare(b.obligationId)
    );
}

/**
 * The single thing most worth doing, with the reason.
 *
 * Returns null when nothing carries real exposure — which is a legitimate and
 * honest answer, and better than promoting the least-irrelevant item to look
 * busy.
 */
export function topExposure(obligations: Obligation[], threshold = 0.1): Exposure | null {
  const ranked = rankByExposure(obligations);
  const top = ranked[0];
  if (!top || top.score < threshold) return null;
  return top;
}

/** Hebrew label for the severity chip. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  penalty_accruing: "קנס שמצטבר",
  penalty_fixed: "קנס או תעריף גבוה יותר",
  blocking: "חוסם פעילות",
  advisory: "חשיפה עסקית",
};
