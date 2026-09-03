import { describe, expect, it } from "vitest";
import { annualTotal, monthlyTotal, oneTimeTotal, type CostRow } from "./costs";

function c(partial: Partial<CostRow>): CostRow {
  return {
    id: Math.random().toString(),
    name: "x",
    amount: 0,
    cadence: "monthly",
    template_id: null,
    renewal_date: null,
    note: null,
    active: true,
    created_at: "2026-01-01",
    ...partial,
  };
}

describe("cost normalization", () => {
  it("normalizes monthly + yearly to a monthly run-rate; excludes one-offs", () => {
    const costs = [
      c({ amount: 50, cadence: "monthly" }),
      c({ amount: 1200, cadence: "yearly" }), // → 100/mo
      c({ amount: 5000, cadence: "one_time" }), // → 0/mo
    ];
    expect(monthlyTotal(costs)).toBe(150);
    expect(annualTotal(costs)).toBe(1800);
    expect(oneTimeTotal(costs)).toBe(5000);
  });

  it("ignores inactive costs", () => {
    expect(monthlyTotal([c({ amount: 99, active: false })])).toBe(0);
  });
});
