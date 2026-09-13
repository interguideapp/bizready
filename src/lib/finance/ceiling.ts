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
