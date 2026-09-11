import { describe, expect, it } from "vitest";
import {
  AGING_AFTER_MONTHS,
  STALE_AFTER_MONTHS,
  formatReviewDate,
  reviewAge,
  stalenessNotice,
} from "./staleness";

describe("reviewAge", () => {
  it("counts whole months only", () => {
    // 2026-09-03 → 2026-09-11 is not yet a month
    expect(reviewAge("2026-09-03", "2026-09-11").months).toBe(0);
    // one day short of a full month still reads 0
    expect(reviewAge("2026-01-15", "2026-02-14").months).toBe(0);
    expect(reviewAge("2026-01-15", "2026-02-15").months).toBe(1);
    expect(reviewAge("2025-09-03", "2026-09-03").months).toBe(12);
  });

  it("classifies fresh / aging / stale at the declared thresholds", () => {
    expect(reviewAge("2026-09-03", "2026-09-11").state).toBe("fresh");
    // exactly at the aging threshold
    expect(reviewAge("2026-01-01", `2026-${String(1 + AGING_AFTER_MONTHS).padStart(2, "0")}-01`).state)
      .toBe("aging");
    // one month before it is still fresh
    expect(reviewAge("2026-01-01", `2026-${String(AGING_AFTER_MONTHS).padStart(2, "0")}-01`).state)
      .toBe("fresh");
    expect(reviewAge("2025-01-01", `2026-01-01`).state).toBe("stale");
    expect(STALE_AFTER_MONTHS).toBeGreaterThan(AGING_AFTER_MONTHS);
  });

  it("treats a missing or malformed date as unknown, never as fresh", () => {
    // The whole point of tracking review age is to stop the product from
    // claiming unverified content is current.
    for (const bad of [null, undefined, "", "2026-09", "not-a-date", "03/09/2026"]) {
      const age = reviewAge(bad, "2026-09-11");
      expect(age.state).toBe("unknown");
      expect(age.months).toBeNull();
      expect(stalenessNotice(age)).not.toBeNull();
    }
  });

  it("does not go negative when a review is stamped ahead of time", () => {
    const age = reviewAge("2027-01-01", "2026-09-11");
    expect(age.months).toBe(0);
    expect(age.state).toBe("fresh");
  });

  it("echoes the review date back for display", () => {
    expect(reviewAge("2026-09-03", "2026-09-11").reviewedOn).toBe("2026-09-03");
  });
});

describe("stalenessNotice", () => {
  it("says nothing when content is fresh — a banner on every task is noise", () => {
    expect(stalenessNotice(reviewAge("2026-09-03", "2026-09-11"))).toBeNull();
  });

  it("warns for aging and stale content", () => {
    expect(stalenessNotice(reviewAge("2025-01-01", "2026-01-01"))).toContain("מעל שנה");
    expect(stalenessNotice(reviewAge("2026-01-01", "2026-10-01"))).toContain("בדיקה תקופתית");
  });
});

describe("formatReviewDate", () => {
  it("renders dd.mm.yyyy", () => {
    expect(formatReviewDate("2026-09-03")).toBe("03.09.2026");
  });
});
