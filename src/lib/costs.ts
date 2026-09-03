/**
 * Cost ledger — "how much do I pay for each thing". Pure helpers over the
 * business_costs rows; normalizes cadences to monthly/annual totals.
 */

export type Cadence = "monthly" | "yearly" | "one_time";

export interface CostRow {
  id: string;
  name: string;
  amount: number;
  cadence: Cadence;
  template_id: string | null;
  renewal_date: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
}

/** A single cost's contribution to the monthly run-rate (one-offs = 0). */
export function monthlyOf(c: Pick<CostRow, "amount" | "cadence" | "active">): number {
  if (!c.active) return 0;
  if (c.cadence === "monthly") return c.amount;
  if (c.cadence === "yearly") return c.amount / 12;
  return 0; // one_time
}

/** Total recurring monthly run-rate. */
export function monthlyTotal(costs: CostRow[]): number {
  return costs.reduce((sum, c) => sum + monthlyOf(c), 0);
}

/** Total recurring annual run-rate (excludes one-offs). */
export function annualTotal(costs: CostRow[]): number {
  return monthlyTotal(costs) * 12;
}

/** Sum of one-time costs (setup spend). */
export function oneTimeTotal(costs: CostRow[]): number {
  return costs
    .filter((c) => c.active && c.cadence === "one_time")
    .reduce((sum, c) => sum + c.amount, 0);
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: "לחודש",
  yearly: "לשנה",
  one_time: "חד-פעמי",
};
