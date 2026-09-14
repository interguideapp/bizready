import { startsWithIsoMonth } from "@/lib/dates";
/**
 * Where a עוסק פטור stands against the annual ceiling.
 *
 * THE BUG THIS EXISTS TO KILL. The panel decided what to say from the rounded
 * display percentage:
 *
 *   const ceilingPct = Math.min(100, Math.round((revenueYtd / ceiling) * 100));
 *   ...
 *   {ceilingPct >= 100 ? "חצית את התקרה — חובה לעבור לעוסק מורשה" : ...}
 *
 * With the 2026 ceiling of ₪122,833, revenue of ₪122,500 rounds to 100 — so a
 * business THREE HUNDRED AND THIRTY-THREE SHEKELS BELOW the ceiling was told it
 * had crossed it and was legally obliged to change its business status. Exact
 * equality was called a crossing too, and being at the ceiling is not exceeding
 * it.
 *
 * A rounded number for a bar's width is fine. A rounded number must never
 * decide a legal claim, which is the whole discipline of this product: the
 * state comes from the real figures, and the percentage is only ever paint.
 */

export type CeilingState = "ok" | "approaching" | "crossed";

/** Where "approaching" starts. Content says planning should begin around 80%. */
export const APPROACHING_FROM = 0.8;

export interface CeilingStanding {
  state: CeilingState;
  /** 0-100, clamped and rounded — for a bar's width, never for a decision. */
  pct: number;
}

/**
 * Has the ceiling been exceeded, given a percentage?
 *
 * Same rule as ceilingStanding, for the callers that only hold a percentage
 * (confidence.ts takes one as input). Exported so "crossed means STRICTLY
 * over" lives in one file: encoding it twice is how the panel and the home
 * hero came to disagree about the boundary in the first place.
 */
export function crossedByPct(pct: number | null | undefined): boolean {
  return pct != null && Number.isFinite(pct) && pct > 100;
}

export function ceilingStanding(revenueYtd: number, ceiling: number): CeilingStanding {
  // A missing or nonsensical ceiling cannot be crossed. Reporting a breach
  // because a figure failed to load would be the worst possible direction to
  // fail in.
  if (!Number.isFinite(ceiling) || ceiling <= 0) return { state: "ok", pct: 0 };
  const revenue = Number.isFinite(revenueYtd) && revenueYtd > 0 ? revenueYtd : 0;

  const state: CeilingState =
    // STRICTLY over. At the ceiling exactly, the exemption still holds.
    revenue > ceiling
      ? "crossed"
      : revenue >= ceiling * APPROACHING_FROM
        ? "approaching"
        : "ok";

  return { state, pct: Math.min(100, Math.round((revenue / ceiling) * 100)) };
}

/**
 * Is the business on course to cross the ceiling, even though it has not yet?
 *
 * YTD against the ceiling is a LAGGING indicator. A עוסק פטור at 60% in June
 * is "ok" by that measure and will cross in September at the same run rate —
 * and crossing retroactively triggers VAT on everything above the ceiling,
 * which is the most expensive surprise in this product's domain. The content
 * itself says planning should start around 80%, precisely because switching
 * takes time.
 *
 * computeForecast has produced exactly this projection all along, tested, and
 * nothing ever called it. This turns it into a statement, and deliberately
 * keeps it separate from `state`: the projection is an extrapolation and must
 * never be reported as a breach. `state` stays the only thing that says
 * anything happened.
 */
export type CeilingOutlook = "none" | "projected_cross";

export function ceilingOutlook(args: {
  state: CeilingState;
  ceiling: number;
  projectedYearEnd: number;
  /** computeForecast's own guard: too early in the year to extrapolate. */
  reliable: boolean;
}): CeilingOutlook {
  // Already over. The breach is a fact and outranks any forecast about it.
  if (args.state === "crossed") return "none";
  if (!args.reliable) return "none";
  if (!Number.isFinite(args.ceiling) || args.ceiling <= 0) return "none";
  if (!Number.isFinite(args.projectedYearEnd)) return "none";
  // Strictly over, same boundary rule as an actual crossing.
  return args.projectedYearEnd > args.ceiling ? "projected_cross" : "none";
}

/**
 * How current the revenue behind a ceiling reading actually is.
 *
 * The ceiling decides a legal fact — over it, an עוסק פטור must register for
 * מע״מ — and the percentage was rendered with no indication of the data's age.
 * revenueYtd is summed from sync_metrics, which the nightly sync fills, and
 * that sync has no fallback: lazy-sweep runs reminders only, so when the
 * schedule is dead the figure is whatever was last pulled by hand.
 *
 * So a business genuinely over the ceiling could read 78% from three-month-old
 * data and conclude it had room. A stale number presented as a current one is
 * worse than no number, because it is acted upon.
 *
 * Months rather than days: revenue metrics are monthly, so "through July" while
 * it is September means August is missing, whatever the day.
 */
export interface RevenueCoverage {
  /** Whole months between the latest covered month and the current one. */
  monthsBehind: number;
  /**
   * True once a month that should have arrived has not. The previous month is
   * allowed: on 3 September, coverage through August is simply up to date.
   */
  behind: boolean;
}

export function revenueCoverage(
  throughMonth: string | null,
  todayIso: string
): RevenueCoverage | null {
  // Prefix, not equality: this is handed a month key OR a full date.
  if (!startsWithIsoMonth(throughMonth)) return null;
  const [ty, tm] = throughMonth.slice(0, 7).split("-").map(Number);
  const [ny, nm] = todayIso.slice(0, 7).split("-").map(Number);
  if (![ty, tm, ny, nm].every(Number.isFinite)) return null;
  const monthsBehind = (ny - ty) * 12 + (nm - tm);
  // Future-dated data is not "behind"; clamp rather than report a negative.
  if (monthsBehind <= 0) return { monthsBehind: 0, behind: false };
  return { monthsBehind, behind: monthsBehind > 1 };
}
