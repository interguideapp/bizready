import { describe, expect, it } from "vitest";
import { annualOccurrence } from "@/lib/compliance";
import type { DateRule } from "@/lib/content/filing-rules";

/**
 * When an annual filing is due, and which tax year it covers.
 *
 * ONE implementation, because there were two: nextStatutoryDueDate (the
 * reminder sweep) and occurrenceFor (the obligations board) each derived the
 * statutory calendar date, the registrar-fee-versus-return year offset, the
 * published-date lookup and the announcedOnly refusal independently, under a
 * comment asserting they "can never disagree about one filing".
 *
 * They agreed byte for byte, because someone duplicated them carefully — and
 * every other duplication this pass consolidated was also written correct and
 * drifted later.
 *
 * WHY THIS FILE EXISTS RATHER THAN A CROSS-CHECK. I first wrote a two-year
 * matrix comparing the two public entry points, and planted a drifted year
 * offset to prove it worked. IT PASSED: `forYear` only feeds the
 * announcedDateFor fallback, which the shipped published map never reaches, so
 * the drift was unobservable from outside. The agreement is structural now
 * anyway — one function, two callers — so what was actually worth testing is
 * the logic itself, which nothing covered. A synthetic rule reaches the branch
 * the real data cannot.
 */
const YEAR_OF = (iso: string) => Number(iso.slice(0, 4));

/** An annual return: the year it covers is the year that just ENDED. */
const returnRule: Extract<DateRule, { anchor: "annual" }> = {
  anchor: "annual",
  month: 4,
  day: 30,
};

/** A registrar fee: billed FOR the year it falls in. */
const feeRule: Extract<DateRule, { anchor: "annual" }> = {
  anchor: "annual",
  month: 3,
  day: 31,
};

describe("which tax year an annual filing covers", () => {
  it("a return covers the year that just ended", () => {
    // 1 February 2026: the next 30 April is 2026, and the return open then is
    // for tax year 2025.
    const o = annualOccurrence({ kind: "annual_report", rule: returnRule }, new Date("2026-02-01T09:00:00Z"))!;
    expect(YEAR_OF(o.dueIso)).toBe(2026);
    expect(o.coveredYear).toBe(2025);
  });

  it("a registrar fee covers the year it falls in", () => {
    // The opposite offset, and the reason the two branches each had a
    // conditional that could drift apart.
    const o = annualOccurrence({ kind: "registrar_fee", rule: feeRule }, new Date("2026-02-01T09:00:00Z"))!;
    expect(YEAR_OF(o.dueIso)).toBe(2026);
    expect(o.coveredYear).toBe(2026);
  });

  it("rolls to next year once the date has passed", () => {
    const o = annualOccurrence({ kind: "registrar_fee", rule: feeRule }, new Date("2026-06-01T09:00:00Z"))!;
    expect(o.dueIso).toBe("2027-03-31");
    expect(o.coveredYear).toBe(2027);
  });
});

describe("a published date beats the calendar", () => {
  it("uses the authority's announced date for the covered year", () => {
    // רשות המסים announces an extension each spring; the bare statutory date
    // would be months early.
    const announced = { ...returnRule, announced: { 2025: "2026-07-31" } };
    const o = annualOccurrence({ kind: "annual_report", rule: announced }, new Date("2026-02-01T09:00:00Z"))!;
    expect(o.dueIso).toBe("2026-07-31");
    expect(o.announced).toBe(true);
    expect(o.coveredYear).toBe(2025);
  });

  it("falls back to the statutory date when nothing is published", () => {
    const o = annualOccurrence({ kind: "annual_report", rule: returnRule }, new Date("2026-02-01T09:00:00Z"))!;
    expect(o.dueIso).toBe("2026-04-30");
    expect(o.announced).toBe(false);
  });

  it("takes the next unpassed published date by DATE, and reports its tax year", () => {
    /**
     * My first version of this asserted the opposite — that a map keyed under
     * the due year rather than the covered year would be ignored — and the
     * code disagreed. The code is right: nextAnnouncedFiling scans for the
     * next published date that has not passed and reports the key it found it
     * under, which is precisely what the comment in compliance.ts describes.
     * Deriving the year from the calendar instead would land on tax year 2026
     * on 1 May 2026, when the return actually open is 2025.
     */
    const announced = { ...returnRule, announced: { 2025: "2026-09-30" } };
    const o = annualOccurrence({ kind: "annual_report", rule: announced }, new Date("2026-02-01T09:00:00Z"))!;
    expect(o.dueIso).toBe("2026-09-30");
    expect(o.coveredYear).toBe(2025);
  });

  it("falls back to the year-keyed lookup once every published date has passed", () => {
    // THE BRANCH the cross-check could not reach, and the only one the year
    // offset governs: with nothing left unpassed in the map, the fallback is
    // announcedDateFor(rule, forYear) — so a return must look under the year
    // that ended, not the year the date falls in.
    const announced = { ...returnRule, announced: { 2024: "2025-07-31" } };
    const o = annualOccurrence(
      { kind: "annual_report", rule: announced },
      new Date("2026-02-01T09:00:00Z")
    )!;
    // Nothing published for 2025, so the statutory calendar date stands.
    expect(o.dueIso).toBe("2026-04-30");
    expect(o.announced).toBe(false);
    expect(o.coveredYear).toBe(2025);
  });
});

describe("refusing to invent a date", () => {
  it("returns nothing for an announcedOnly filing with no published date", () => {
    // An invented deadline on the largest penalty exposure in the product is
    // worse than admitting it is not published yet.
    const rule = { ...returnRule, announcedOnly: true };
    expect(annualOccurrence({ kind: "annual_report", rule }, new Date("2026-02-01T09:00:00Z"))).toBeNull();
  });

  it("still answers an announcedOnly filing once the date exists", () => {
    const rule = { ...returnRule, announcedOnly: true, announced: { 2025: "2026-07-31" } };
    const o = annualOccurrence({ kind: "annual_report", rule }, new Date("2026-02-01T09:00:00Z"))!;
    expect(o.dueIso).toBe("2026-07-31");
  });

  it("does not withhold a date from a filing that is not announcedOnly", () => {
    // The registrar fee is a fixed statutory date and must never go silent.
    expect(
      annualOccurrence({ kind: "registrar_fee", rule: feeRule }, new Date("2026-02-01T09:00:00Z"))
    ).not.toBeNull();
  });
});
