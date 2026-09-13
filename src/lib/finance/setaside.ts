/**
 * Tax set-aside — a deliberately conservative RULE OF THUMB, never an exact
 * figure. A new עצמאי should park roughly 25–35% of revenue for income tax +
 * ביטוח לאומי (VAT is collected and remitted separately by an עוסק מורשה).
 * Everything that consumes this must label it "הערכה — לאימות מול רו״ח".
 */
/**
 * The caveat, written once.
 *
 * The module's contract — "everything that consumes this must label it" — was
 * enforced by nothing, and the home tile duly carried half of it. Keeping the
 * sentence here rather than in each consumer means a new surface either uses
 * the constant or fails the test that looks for it, instead of paraphrasing
 * the caveat away.
 */
export const SETASIDE_ESTIMATE_NOTE = "הערכה בלבד — לאימות מול רו״ח.";

export const SETASIDE_LOW = 0.25;
export const SETASIDE_HIGH = 0.35;

export interface SetAside {
  /** low end of the recommended set-aside, ₪ */
  low: number;
  /** high end, ₪ */
  high: number;
}

export function computeSetAside(revenueYtd: number): SetAside {
  const rev = Math.max(0, revenueYtd);
  return {
    low: Math.round(rev * SETASIDE_LOW),
    high: Math.round(rev * SETASIDE_HIGH),
  };
}
