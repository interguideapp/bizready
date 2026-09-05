import { describe, expect, it } from "vitest";
import { computeSetAside, SETASIDE_HIGH, SETASIDE_LOW } from "./setaside";

describe("computeSetAside", () => {
  it("returns the 25–35% band of revenue", () => {
    const s = computeSetAside(100_000);
    expect(s.low).toBe(25_000);
    expect(s.high).toBe(35_000);
  });

  it("clamps negative revenue to zero", () => {
    expect(computeSetAside(-500)).toEqual({ low: 0, high: 0 });
  });

  it("low is always ≤ high and matches the exported rates", () => {
    const rev = 73_450;
    const s = computeSetAside(rev);
    expect(s.low).toBe(Math.round(rev * SETASIDE_LOW));
    expect(s.high).toBe(Math.round(rev * SETASIDE_HIGH));
    expect(s.low).toBeLessThanOrEqual(s.high);
  });
});
