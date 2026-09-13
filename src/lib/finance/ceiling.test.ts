import { describe, expect, it } from "vitest";
import {
  APPROACHING_FROM,
  ceilingOutlook,
  ceilingStanding,
  crossedByPct,
} from "@/lib/finance/ceiling";
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

/**
 * On course to cross, though not there yet.
 *
 * YTD against the ceiling is a lagging indicator: 60% in June reads "ok" and
 * crosses in September at the same run rate. Crossing retroactively triggers
 * VAT on everything above the ceiling, and switching to עוסק מורשה takes time,
 * which is why the content says planning should start around 80%.
 *
 * computeForecast produced exactly this projection all along, unit-tested, and
 * nothing in the product ever called it.
 */
describe("the ceiling outlook, kept separate from the ceiling state", () => {
  const base = { state: "ok" as const, ceiling: CEILING, reliable: true };

  it("warns when the run rate lands above the ceiling", () => {
    expect(ceilingOutlook({ ...base, projectedYearEnd: CEILING * 1.4 })).toBe(
      "projected_cross"
    );
  });

  it("stays quiet when the run rate lands below it", () => {
    expect(ceilingOutlook({ ...base, projectedYearEnd: CEILING * 0.7 })).toBe("none");
  });

  it("uses the same strict boundary as an actual crossing", () => {
    // Projected to land exactly on the ceiling is not projected to exceed it.
    expect(ceilingOutlook({ ...base, projectedYearEnd: CEILING })).toBe("none");
    expect(ceilingOutlook({ ...base, projectedYearEnd: CEILING + 1 })).toBe(
      "projected_cross"
    );
  });

  it("says nothing before there is enough of the year to extrapolate", () => {
    // computeForecast's own guard. A run rate from three days of data would
    // manufacture alarm out of noise.
    expect(
      ceilingOutlook({ ...base, reliable: false, projectedYearEnd: CEILING * 3 })
    ).toBe("none");
  });

  it("defers to a real crossing rather than forecasting about it", () => {
    // The breach is a fact and outranks a projection of the same thing.
    expect(
      ceilingOutlook({ ...base, state: "crossed", projectedYearEnd: CEILING * 2 })
    ).toBe("none");
  });

  it("still warns an approaching business, which is the whole point", () => {
    expect(
      ceilingOutlook({ ...base, state: "approaching", projectedYearEnd: CEILING * 1.2 })
    ).toBe("projected_cross");
  });

  it("says nothing when the figures are unusable", () => {
    expect(ceilingOutlook({ ...base, ceiling: 0, projectedYearEnd: 999_999 })).toBe("none");
    expect(ceilingOutlook({ ...base, projectedYearEnd: Number.NaN })).toBe("none");
  });

  it("never reports a projection as the state", () => {
    // The separation that matters: a forecast must not be able to make
    // ceilingStanding say "crossed".
    const standing = ceilingStanding(CEILING * 0.6, CEILING);
    expect(standing.state).not.toBe("crossed");
    expect(
      ceilingOutlook({
        state: standing.state,
        ceiling: CEILING,
        projectedYearEnd: CEILING * 5,
        reliable: true,
      })
    ).toBe("projected_cross");
    expect(ceilingStanding(CEILING * 0.6, CEILING).state).toBe(standing.state);
  });
});
