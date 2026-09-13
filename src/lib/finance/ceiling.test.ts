import { describe, expect, it } from "vitest";
import { APPROACHING_FROM, ceilingStanding, crossedByPct } from "@/lib/finance/ceiling";
import { YEARLY_FIGURES } from "@/lib/types";

/**
 * Whether a עוסק פטור has crossed the ceiling.
 *
 * The panel used to decide this from the ROUNDED display percentage:
 * Math.min(100, Math.round((revenueYtd / ceiling) * 100)) >= 100. Against the
 * 2026 ceiling of ₪122,833 that made ₪122,500 read as 100 — so a business
 * ₪333 BELOW the ceiling was told it had crossed it and was legally obliged to
 * change its business status. Exact equality was called a crossing too, and
 * being at the ceiling is not exceeding it.
 *
 * A rounded number may paint a bar. It may never decide a legal claim.
 */
const CEILING = YEARLY_FIGURES.osekPaturCeiling;

describe("the exact figures decide, not the rounded percentage", () => {
  it("does not claim a crossing ₪333 below the ceiling", () => {
    // The number that rounds to 100 and started all this.
    const at = ceilingStanding(122_500, 122_833);
    expect(at.pct).toBe(100);
    expect(at.state).toBe("approaching");
  });

  it("does not claim a crossing AT the ceiling exactly", () => {
    // The exemption holds at the ceiling; it is exceeding it that ends it.
    expect(ceilingStanding(CEILING, CEILING).state).toBe("approaching");
  });

  it("claims a crossing one shekel over", () => {
    expect(ceilingStanding(CEILING + 1, CEILING).state).toBe("crossed");
  });

  it("keeps the bar clamped even when revenue is far past the ceiling", () => {
    const over = ceilingStanding(CEILING * 3, CEILING);
    expect(over.pct).toBe(100);
    expect(over.state).toBe("crossed");
  });
});

describe("the approaching band", () => {
  it("starts at the declared fraction and not before", () => {
    const justBelow = ceilingStanding(Math.floor(CEILING * APPROACHING_FROM) - 1, CEILING);
    expect(justBelow.state).toBe("ok");
    expect(ceilingStanding(Math.ceil(CEILING * APPROACHING_FROM), CEILING).state).toBe("approaching");
  });
});

describe("it fails in the safe direction", () => {
  it("reports no breach when the ceiling figure is missing", () => {
    // A figure that failed to load must never be reported as a legal breach.
    expect(ceilingStanding(500_000, 0).state).toBe("ok");
    expect(ceilingStanding(500_000, Number.NaN).state).toBe("ok");
  });

  it("treats absent or negative revenue as zero", () => {
    expect(ceilingStanding(Number.NaN, CEILING)).toEqual({ state: "ok", pct: 0 });
    expect(ceilingStanding(-100, CEILING)).toEqual({ state: "ok", pct: 0 });
  });
});

describe("the boundary rule is shared, not encoded twice", () => {
  it("agrees with ceilingStanding at every boundary", () => {
    // The panel and the home hero disagreed about this boundary because each
    // had its own comparison. One rule, checked against the other.
    for (const revenue of [
      0,
      CEILING - 1,
      CEILING,
      CEILING + 1,
      Math.floor(CEILING * 0.997),
      CEILING * 2,
    ]) {
      const pct = (revenue / CEILING) * 100;
      expect(crossedByPct(pct), String(revenue)).toBe(
        ceilingStanding(revenue, CEILING).state === "crossed"
      );
    }
  });

  it("does not call an absent percentage a breach", () => {
    expect(crossedByPct(null)).toBe(false);
    expect(crossedByPct(undefined)).toBe(false);
    expect(crossedByPct(Number.NaN)).toBe(false);
  });

  it("is false at exactly 100", () => {
    expect(crossedByPct(100)).toBe(false);
    expect(crossedByPct(100.0001)).toBe(true);
  });
});
