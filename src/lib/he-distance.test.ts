import { describe, expect, it } from "vitest";
import { aheadLabel, daysUntilIso, distanceLabel, lateLabel } from "@/lib/he-distance";

/**
 * One vocabulary for "how far away is this".
 *
 * There were five copies, disagreeing. The badge on every task row said
 * "עבר המועד" whether a filing was five days late or a hundred and sixty-five;
 * the obligations board said "באיחור כחודשיים"; insights said
 * "באיחור 60 ימים"; the cycle note said something else again. Same fact, four
 * answers, decided by which screen the user was on.
 */

describe("how late", () => {
  it("distinguishes five days from five months", () => {
    expect(lateLabel(5)).not.toBe(lateLabel(160));
  });

  it("uses the Hebrew dual instead of a numeral", () => {
    // "2 ימים" and "כ-2 חודשים" are the translated-from-English texture the
    // product has been clearing out.
    expect(lateLabel(1)).toBe("באיחור יום");
    expect(lateLabel(2)).toBe("באיחור יומיים");
    expect(lateLabel(66)).toBe("באיחור כחודשיים");
  });

  it("switches from days to months once the day count stops meaning anything", () => {
    expect(lateLabel(59)).toBe("באיחור 59 ימים");
    expect(lateLabel(95)).toBe("באיחור כ-3 חודשים");
  });

  it("stops counting past a year, where no number helps", () => {
    expect(lateLabel(400)).toBe("באיחור למעלה משנה");
  });
});

describe("how far ahead", () => {
  it("names the near days rather than counting them", () => {
    expect(aheadLabel(0)).toBe("היום");
    expect(aheadLabel(1)).toBe("מחר");
    expect(aheadLabel(2)).toBe("מחרתיים");
  });

  it("counts days while the count is useful and months after", () => {
    expect(aheadLabel(12)).toBe("בעוד 12 ימים");
    expect(aheadLabel(63)).toBe("בעוד כחודשיים");
    expect(aheadLabel(400)).toBe("בעוד למעלה משנה");
  });

  it("never produces a singular noun with a plural count", () => {
    // "בעוד 1 ימים" was reachable in two of the old copies.
    for (let d = 0; d <= 400; d++) {
      expect(aheadLabel(d)).not.toMatch(/\b1 ימים|\b2 ימים|כ-1 חודשים|כ-2 חודשים/);
      expect(lateLabel(Math.max(1, d))).not.toMatch(/\b1 ימים|\b2 ימים|כ-1 חודשים|כ-2 חודשים/);
    }
  });
});

describe("the signed form every caller actually has", () => {
  it("routes negatives to late and the rest to ahead", () => {
    expect(distanceLabel(-5)).toBe(lateLabel(5));
    expect(distanceLabel(0)).toBe("היום");
    expect(distanceLabel(9)).toBe(aheadLabel(9));
  });

  it("only ever claims lateness for a date that has actually passed", () => {
    // A deadline falling today is not late. Judging otherwise is how a product
    // in a UTC+3 country tells people they missed something at 01:00.
    for (let d = -3; d <= 3; d++) {
      const late = distanceLabel(d).startsWith("באיחור");
      expect(late).toBe(d < 0);
    }
  });
});

describe("days between two dates", () => {
  it("counts calendar days, not elapsed hours", () => {
    expect(daysUntilIso("2026-09-15", "2026-09-13")).toBe(2);
    expect(daysUntilIso("2026-09-13", "2026-09-13")).toBe(0);
    expect(daysUntilIso("2026-09-08", "2026-09-13")).toBe(-5);
  });

  it("is unaffected by a DST boundary", () => {
    // Israel shifts at the end of October, and an hour lost mid-range used to
    // round a 31-day gap to 30 in engines that divided elapsed milliseconds.
    expect(daysUntilIso("2026-11-01", "2026-10-01")).toBe(31);
  });
});
