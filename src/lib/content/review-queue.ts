import { TASK_TEMPLATES } from "@/lib/content";
import { FIGURES, type FigureKey } from "@/lib/content/figures";
import { legalBasisOf, type LegalBasis } from "@/lib/content/legal-basis";
import { reviewAge, type ReviewState } from "@/lib/staleness";
import type { TaskTemplate } from "@/lib/types";

/**
 * What needs a human to go and check it against the source.
 *
 * Until now there was no mechanism at all: `last_reviewed` was write-only, and
 * only two distinct values existed across all 70 templates (2026-09-03 ×62,
 * 2026-09-09 ×8), which means the field recorded when the FILE was last touched,
 * not when the RULE was last verified. Nobody could answer "which of our legal
 * claims are we no longer sure about?".
 *
 * This module answers that, as a pure function so it can be tested and so the
 * admin page, a future cron and any CLI report all rank things identically.
 *
 * Ranking is by consequence, not by age. A stale `statute` task is the product
 * telling a business owner "the law requires this" on the strength of a check
 * nobody has repeated in over a year. A stale `commercial` task is a slightly
 * old marketing tip. Those are not the same problem and must not sort together.
 */

export type ReviewUrgency = "now" | "soon" | "watch";

export interface ReviewItem {
  kind: "template" | "figure";
  id: string;
  title: string;
  urgency: ReviewUrgency;
  /** Why it surfaced, in one Hebrew sentence. */
  reason: string;
  /** Whose claim it is — drives the ranking. */
  legalBasis: LegalBasis;
  reviewState: ReviewState;
  monthsSinceReview: number | null;
  /** Where to go and check. */
  source: string | null;
}

const URGENCY_RANK: Record<ReviewUrgency, number> = { now: 0, soon: 1, watch: 2 };
const BASIS_RANK: Record<LegalBasis, number> = {
  statute: 0,
  regulator_guidance: 1,
  best_practice: 2,
  commercial: 3,
};

/**
 * A statute claim that has aged out is urgent. The same age on a commercial
 * suggestion is not — and conflating them is how review queues become noise
 * that nobody opens.
 */
function urgencyFor(basis: LegalBasis, state: ReviewState): ReviewUrgency | null {
  if (state === "fresh") return null;
  if (state === "unknown") return basis === "statute" ? "now" : "soon";
  if (basis === "statute") return state === "stale" ? "now" : "soon";
  if (basis === "regulator_guidance") return state === "stale" ? "soon" : "watch";
  return state === "stale" ? "watch" : null;
}

function templateItem(t: TaskTemplate, todayIso: string): ReviewItem | null {
  const basis = legalBasisOf(t.id);
  const age = reviewAge(t.last_reviewed, todayIso);
  const urgency = urgencyFor(basis, age.state);
  if (!urgency) return null;

  const reason =
    age.state === "unknown"
      ? "לא רשום מתי נבדק מול המקור"
      : age.state === "stale"
        ? `לא נבדק מול המקור ${age.months} חודשים`
        : `ממתין לבדיקה תקופתית (${age.months} חודשים)`;

  return {
    kind: "template",
    id: t.id,
    title: t.title,
    urgency,
    reason,
    legalBasis: basis,
    reviewState: age.state,
    monthsSinceReview: age.months,
    source: t.source_url ?? t.official_links[0]?.url ?? null,
  };
}

/**
 * Figures are reviewed per tax YEAR, not per month: the registrar fees and the
 * עוסק פטור ceiling are re-published annually, so the question is never "is this
 * six months old" but "is this last year's number?".
 */
function figureItems(todayIso: string): ReviewItem[] {
  const currentYear = Number(todayIso.slice(0, 4));
  const out: ReviewItem[] = [];
  for (const key of Object.keys(FIGURES) as FigureKey[]) {
    const f = FIGURES[key];
    if (f.year >= currentYear) continue;
    const yearsBehind = currentYear - f.year;
    out.push({
      kind: "figure",
      id: key,
      title: f.label,
      // A figure from a previous tax year is being shown to users as current.
      // That is a wrong number on screen, not a scheduling matter.
      urgency: "now",
      reason: `הסכום הוא לשנת ${f.year} ואנחנו כבר ב-${currentYear}${
        yearsBehind > 1 ? ` (${yearsBehind} שנים אחורה)` : ""
      }`,
      legalBasis: "statute",
      reviewState: "stale",
      monthsSinceReview: yearsBehind * 12,
      source: f.source,
    });
  }
  return out;
}

/**
 * The full queue, most consequential first. Pure — pass the date in.
 */
export function buildReviewQueue(todayIso: string): ReviewItem[] {
  const items = [
    ...figureItems(todayIso),
    ...TASK_TEMPLATES.map((t) => templateItem(t, todayIso)).filter(
      (i): i is ReviewItem => i !== null
    ),
  ];

  return items.sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      BASIS_RANK[a.legalBasis] - BASIS_RANK[b.legalBasis] ||
      (b.monthsSinceReview ?? 0) - (a.monthsSinceReview ?? 0) ||
      a.id.localeCompare(b.id)
  );
}

/** Counts for the admin header, so "nothing to do" is stated rather than implied. */
export function reviewQueueSummary(items: ReviewItem[]) {
  return {
    total: items.length,
    now: items.filter((i) => i.urgency === "now").length,
    soon: items.filter((i) => i.urgency === "soon").length,
    watch: items.filter((i) => i.urgency === "watch").length,
    /** Statute claims we are no longer sure about — the number that matters. */
    unsourcedStatuteClaims: items.filter(
      (i) => i.legalBasis === "statute" && i.urgency === "now"
    ).length,
  };
}

export const URGENCY_LABEL: Record<ReviewUrgency, string> = {
  now: "לבדוק עכשיו",
  soon: "לבדוק בקרוב",
  watch: "למעקב",
};

/**
 * The annual figures checklist, gated to the window when Israel publishes the
 * new year's amounts. Showing it all year would train whoever reads this page
 * to scroll past it; showing it in January and February is when it is actionable.
 */
export function januaryFiguresDue(todayIso: string): boolean {
  const month = Number(todayIso.slice(5, 7));
  const year = Number(todayIso.slice(0, 4));
  const anyFigureBehind = (Object.keys(FIGURES) as FigureKey[]).some(
    (k) => FIGURES[k].year < year
  );
  return (month === 1 || month === 2) && anyFigureBehind;
}
