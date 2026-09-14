import { describe, expect, it } from "vitest";
import { nextFilingPeriod } from "@/lib/compliance";
import { dueForPeriod, periodEndingAt, periodForDue } from "@/lib/filings";
import { todayInIsrael } from "@/lib/dates";

/**
 * ONE ANSWER TO "WHICH PERIOD, AND WHEN IS IT DUE?".
 *
 * compliance.ts declared its own FilingPeriod — {startAbs, endAbs, dueIso} —
 * alongside the exported one in filings.ts that also carries the stored key
 * and the label. Two shapes under one name, and worse, two implementations of
 * the deadline: compliance built "the 15th of the month after the period"
 * inline while filings.ts computes it in dueForPeriod.
 *
 * They agreed. They are also the most consequential date in the product: every
 * VAT and advances filing hangs on it, the obligations board reads it from
 * compliance, and the filing ledger keys its rows from filings. The audit's B3
 * explicitly contemplates encoding the online-filing extension into that date
 * — precisely the edit that would have made the board and the ledger disagree
 * about when a filing is due, silently, with every test green.
 *
 * nextFilingPeriod now decides only WHICH period is still open, which is the
 * one thing it knows that filings.ts does not, and takes the period itself
 * from periodEndingAt.
 */
const FREQUENCIES = ["monthly", "bimonthly"] as const;

describe("the open period is a period the ledger would recognise", () => {
  it("carries the stored key, which the old shape did not have at all", () => {
    for (const frequency of FREQUENCIES) {
      const period = nextFilingPeriod(new Date("2026-09-14T09:00:00Z"), frequency);
      expect(period.key, frequency).toMatch(/^[0-9]{4}-[0-9]{2}[.][.][0-9]{4}-[0-9]{2}$/);
      expect(period.label, frequency).toBeTruthy();
    }
  });

  it("is identical to periodEndingAt for its own end month", () => {
    // The property that makes it one authority rather than two that agree.
    for (const frequency of FREQUENCIES) {
      const period = nextFilingPeriod(new Date("2026-09-14T09:00:00Z"), frequency);
      expect(periodEndingAt(period.endAbs, frequency)).toEqual(period);
    }
  });

  it("its deadline is the one dueForPeriod gives, not a second formula", () => {
    for (const frequency of FREQUENCIES) {
      const period = nextFilingPeriod(new Date("2026-09-14T09:00:00Z"), frequency);
      expect(period.dueIso, frequency).toBe(dueForPeriod(period.endAbs));
    }
  });

  it("round-trips through periodForDue, which records the filing", () => {
    // At completion time the period is derived from the stored deadline. If
    // that disagreed with the board's period, a filing would be recorded
    // against the wrong months.
    for (const frequency of FREQUENCIES) {
      const period = nextFilingPeriod(new Date("2026-09-14T09:00:00Z"), frequency);
      expect(periodForDue(period.dueIso, frequency)!.key, frequency).toBe(period.key);
    }
  });
});

describe("it still returns the next deadline that has not passed", () => {
  /**
   * The behaviour the loop exists for, asserted across a year so the
   * consolidation cannot have changed which period is chosen.
   */
  it("never returns a deadline in the past, at any point in a year", () => {
    for (const frequency of FREQUENCIES) {
      for (let day = 0; day < 365; day += 7) {
        const at = new Date(Date.UTC(2026, 0, 1 + day, 9));
        const period = nextFilingPeriod(at, frequency);
        expect(period.dueIso >= todayInIsrael(at), `${frequency} ${at.toISOString()}`).toBe(true);
        // And it is the NEAREST such deadline: one period earlier must be past.
        const earlier = periodEndingAt(period.endAbs - (frequency === "monthly" ? 1 : 2), frequency);
        expect(earlier.dueIso < todayInIsrael(at), `${frequency} ${at.toISOString()}`).toBe(true);
      }
    }
  });

  it("a bimonthly period always ends on an odd calendar month", () => {
    // Israeli bimonthly periods are Jan-Feb, Mar-Apr, …, so the end month is
    // February (1), April (3), and so on.
    for (let day = 0; day < 365; day += 11) {
      const at = new Date(Date.UTC(2026, 0, 1 + day, 9));
      expect(nextFilingPeriod(at, "bimonthly").endAbs % 2, at.toISOString()).toBe(1);
    }
  });

  it("a monthly period is a single month", () => {
    for (let day = 0; day < 365; day += 11) {
      const at = new Date(Date.UTC(2026, 0, 1 + day, 9));
      const period = nextFilingPeriod(at, "monthly");
      expect(period.startAbs, at.toISOString()).toBe(period.endAbs);
    }
  });
});
