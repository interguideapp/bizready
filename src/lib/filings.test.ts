import { describe, expect, it } from "vitest";
import {
  dueForPeriod,
  missedPeriods,
  missedPeriodsFor,
  periodEndingAt,
  periodForDue,
  periodLabel,
  periodsDueSince,
} from "./filings";

/**
 * Period identity, which decides whether a business is told it owes a filing.
 *
 * A wrong answer here is not cosmetic in either direction: a false positive
 * accuses someone of missing a statutory deadline, and a false negative is the
 * product failing at its one job.
 */
describe("period identity", () => {
  it("keys a bimonthly period by its own months, not by its deadline", () => {
    // Keyed from the period so the key survives a change to filing deadlines.
    const p = periodEndingAt(2026 * 12 + 7, "bimonthly"); // August 2026
    expect(p.key).toBe("2026-07..2026-08");
    expect(p.label).toBe("יולי–אוגוסט 2026");
    expect(p.dueIso).toBe("2026-09-15");
  });

  it("keys a monthly period as a single month", () => {
    const p = periodEndingAt(2026 * 12 + 7, "monthly");
    expect(p.key).toBe("2026-08..2026-08");
    expect(p.label).toBe("אוגוסט 2026");
    expect(p.dueIso).toBe("2026-09-15");
  });

  it("puts the deadline in the month after the period", () => {
    expect(dueForPeriod(2026 * 12 + 11)).toBe("2027-01-15"); // Dec 2026 -> Jan
  });

  it("labels a period that spans a year boundary", () => {
    // Nov–Dec is a real bimonth; Dec–Jan is not, but the label must still be
    // right if one is ever constructed.
    expect(periodLabel(2026 * 12 + 11, 2027 * 12)).toBe("דצמבר 2026 – ינואר 2027");
  });

  it("recovers the period from a deadline", () => {
    // This is the direction that matters when recording a filing: a late filer
    // is no longer standing in the period they are filing for.
    expect(periodForDue("2026-09-15", "bimonthly")!.key).toBe("2026-07..2026-08");
    expect(periodForDue("2027-01-15", "bimonthly")!.key).toBe("2026-11..2026-12");
    expect(periodForDue("2026-09-15", "monthly")!.key).toBe("2026-08..2026-08");
  });

  it("refuses a malformed deadline rather than guessing", () => {
    expect(periodForDue("15/09/2026", "bimonthly")).toBeNull();
    expect(periodForDue("", "bimonthly")).toBeNull();
    expect(periodForDue("2026-13-15", "bimonthly")).toBeNull();
  });
});

describe("which periods have come due", () => {
  const frequency = "bimonthly" as const;

  it("lists every passed deadline from the first one, oldest first", () => {
    const due = periodsDueSince({
      fromIso: "2026-03-15",
      todayIso: "2026-09-20",
      frequency,
    });
    expect(due.map((p) => p.key)).toEqual([
      "2026-01..2026-02",
      "2026-03..2026-04",
      "2026-05..2026-06",
      "2026-07..2026-08",
    ]);
  });

  it("does not count a deadline that falls today as missed", () => {
    // You have until the day itself.
    const due = periodsDueSince({
      fromIso: "2026-09-15",
      todayIso: "2026-09-15",
      frequency,
    });
    expect(due).toEqual([]);
  });

  it("counts it the day after", () => {
    const due = periodsDueSince({
      fromIso: "2026-09-15",
      todayIso: "2026-09-16",
      frequency,
    });
    expect(due.map((p) => p.key)).toEqual(["2026-07..2026-08"]);
  });

  it("never invents a bimonthly period ending in an odd calendar month", () => {
    // Bimonths are Jan–Feb, Mar–Apr… A period ending in January does not exist,
    // and offering one would put a filing against months the authority does
    // not recognise.
    const due = periodsDueSince({
      fromIso: "2026-03-15",
      todayIso: "2027-06-20",
      frequency,
    });
    for (const p of due) {
      expect(p.endAbs % 2, `${p.key} ends in the wrong month`).toBe(1);
    }
  });

  it("enumerates monthly periods without gaps", () => {
    const due = periodsDueSince({
      fromIso: "2026-07-15",
      todayIso: "2026-11-20",
      frequency: "monthly",
    });
    expect(due.map((p) => p.key)).toEqual([
      "2026-06..2026-06",
      "2026-07..2026-07",
      "2026-08..2026-08",
      "2026-09..2026-09",
      "2026-10..2026-10",
    ]);
  });

  it("caps the list rather than generating years of debt", () => {
    // A business a decade behind needs an accountant, not a hundred rows — and
    // an uncapped loop on a bad date is a hang.
    const due = periodsDueSince({
      fromIso: "2010-01-15",
      todayIso: "2026-09-20",
      frequency,
      maxPeriods: 6,
    });
    expect(due).toHaveLength(6);
  });

  it("returns nothing for an unusable date instead of looping", () => {
    expect(periodsDueSince({ fromIso: "nope", todayIso: "2026-09-20", frequency })).toEqual([]);
    expect(periodsDueSince({ fromIso: "2026-09-15", todayIso: "nope", frequency })).toEqual([]);
  });
});

describe("which periods were missed", () => {
  const due = periodsDueSince({
    fromIso: "2026-03-15",
    todayIso: "2026-09-20",
    frequency: "bimonthly",
  });

  it("reports every unfiled period, not only the oldest", () => {
    // The limitation this whole module exists to remove: inferring a missed
    // period from the task's stored deadline could only ever surface one, so a
    // business two periods behind heard about the first and never the second.
    const missed = missedPeriods(due, ["2026-01..2026-02", "2026-03..2026-04"]);
    expect(missed.map((p) => p.key)).toEqual(["2026-05..2026-06", "2026-07..2026-08"]);
  });

  it("reports nothing when everything is filed", () => {
    expect(missedPeriods(due, due.map((p) => p.key))).toEqual([]);
  });

  it("ignores a recorded filing for a period that is not due yet", () => {
    // Filing early is allowed and must not shift anything.
    const missed = missedPeriods(due, ["2026-09..2026-10"]);
    expect(missed).toHaveLength(due.length);
  });
});

describe("the honesty guard on history we never recorded", () => {
  it("never accuses a business of periods predating the record", () => {
    // Recording started at a point in time. Treating absence of a record as
    // absence of a filing would have accused every existing user of years of
    // non-compliance the day this shipped.
    const missed = missedPeriodsFor({
      firstDueIso: "2025-03-15",
      todayIso: "2026-09-20",
      frequency: "bimonthly",
      filedKeys: [],
      knownFrom: "2026-09-01",
    });
    expect(missed.map((p) => p.key)).toEqual(["2026-07..2026-08"]);
  });

  it("reports everything once the record covers the whole span", () => {
    const missed = missedPeriodsFor({
      firstDueIso: "2026-07-15",
      todayIso: "2026-12-20",
      frequency: "bimonthly",
      filedKeys: [],
      knownFrom: "2026-01-01",
    });
    expect(missed.map((p) => p.key)).toEqual(["2026-05..2026-06", "2026-07..2026-08", "2026-09..2026-10"]);
  });

  it("reports nothing when the guard excludes everything", () => {
    const missed = missedPeriodsFor({
      firstDueIso: "2026-03-15",
      todayIso: "2026-09-20",
      frequency: "bimonthly",
      filedKeys: [],
      knownFrom: "2027-01-01",
    });
    expect(missed).toEqual([]);
  });
});
