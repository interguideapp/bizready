import { describe, expect, it } from "vitest";
import {
  deadlineOptions,
  deadlineWarning,
  effectiveDeadline,
  isComputable,
  isDemandTriggered,
  officialOptions,
  onDemandDeadline,
  prepareBeforeOption,
  relativeOptions,
} from "./deadline-options";
import { filingRuleFor } from "./content/filing-rules";

/**
 * Deadline arithmetic, which the user used to do in their head.
 *
 * Every case here is a date a business owner would otherwise have counted out
 * on a calendar, and two of them (the month-end boundary and the 120-day
 * demand window) are ones people get wrong.
 */
describe("relative options", () => {
  it("counts a week and a fortnight from the given day", () => {
    const o = relativeOptions("2026-09-12");
    expect(o.find((x) => x.id === "tomorrow")!.date).toBe("2026-09-13");
    expect(o.find((x) => x.id === "week")!.date).toBe("2026-09-19");
    expect(o.find((x) => x.id === "two-weeks")!.date).toBe("2026-09-26");
  });

  it("crosses a month boundary", () => {
    expect(relativeOptions("2026-09-28").find((x) => x.id === "week")!.date).toBe("2026-10-05");
  });

  it("crosses a year boundary", () => {
    expect(relativeOptions("2026-12-28").find((x) => x.id === "week")!.date).toBe("2027-01-04");
  });

  it("gets end-of-month right in a 31-day month", () => {
    expect(relativeOptions("2026-07-03").find((x) => x.id === "end-of-month")!.date).toBe(
      "2026-07-31"
    );
  });

  it("gets end-of-month right in February", () => {
    // 2028 is a leap year; 2026 is not. Hard-coding 28 or 30 would pass one.
    expect(relativeOptions("2026-02-03").find((x) => x.id === "end-of-month")!.date).toBe(
      "2026-02-28"
    );
    expect(relativeOptions("2028-02-03").find((x) => x.id === "end-of-month")!.date).toBe(
      "2028-02-29"
    );
  });

  it("does not offer end-of-month when today already is", () => {
    expect(relativeOptions("2026-09-30").some((x) => x.id === "end-of-month")).toBe(false);
  });

  it("survives a malformed date instead of producing Invalid Date", () => {
    // The value reaches here from a date input, which can be cleared or typed
    // into on some browsers.
    for (const o of relativeOptions("not-a-date")) expect(o.date).toBe("not-a-date");
  });
});

describe("official dates come from the registry, never from arithmetic here", () => {
  it("offers the statutory date with its source attached", () => {
    const [opt] = officialOptions("vat-reporting", "2026-11-15");
    expect(opt.date).toBe("2026-11-15");
    expect(opt.kind).toBe("official");
    // Every official option must be traceable to the page it was read from.
    expect(opt.source).toBe(filingRuleFor("vat-reporting")!.source);
  });

  it("offers nothing for a task with no filing rule", () => {
    expect(officialOptions("buy-domain", "2026-11-15")).toEqual([]);
  });

  it("offers nothing when the statutory date is unknown", () => {
    // The annual return's date is announced each spring. Until it is, the
    // product shows no date at all rather than the bare statutory one.
    expect(officialOptions("vat-reporting", null)).toEqual([]);
  });

  it("knows which rules cannot be computed without asking", () => {
    const onDemand = filingRuleFor("capital-statement-prep")!.rule;
    expect(isComputable(onDemand, 2026)).toBe(false);

    const annual = filingRuleFor("company-annual-report-financials")!.rule;
    // Published years are computable; an unpublished one is not.
    expect(isComputable(annual, 2025)).toBe(true);
    expect(isComputable(annual, 2099)).toBe(false);

    expect(isComputable(filingRuleFor("company-annual-fee")!.rule, 2026)).toBe(true);
  });
});

describe("the demand-triggered window, which nobody should count by hand", () => {
  it("computes 120 days from the demand date", () => {
    expect(isDemandTriggered("capital-statement-prep")).toBe(true);
    const r = onDemandDeadline("capital-statement-prep", "2026-09-12")!;
    expect(r.days).toBe(120);
    expect(r.date).toBe("2027-01-10");
  });

  it("refuses to apply the demand window to a task with a calendar deadline", () => {
    // Offering "120 days from now" for VAT would invent a deadline.
    expect(onDemandDeadline("vat-reporting", "2026-09-12")).toBeNull();
    expect(isDemandTriggered("vat-reporting")).toBe(false);
  });

  it("rejects a demand date that is not a date", () => {
    expect(onDemandDeadline("capital-statement-prep", "12/09/2026")).toBeNull();
    expect(onDemandDeadline("capital-statement-prep", "")).toBeNull();
  });
});

describe("preparing before the legal date", () => {
  it("offers a week of slack before the deadline", () => {
    const o = prepareBeforeOption("2026-11-15", "2026-09-12")!;
    expect(o.date).toBe("2026-11-08");
  });

  it("offers nothing when that week has already passed", () => {
    // Suggesting a date in the past is worse than suggesting nothing.
    expect(prepareBeforeOption("2026-09-15", "2026-09-12")).toBeNull();
  });
});

describe("warning about a date that plans to be late", () => {
  it("warns when the chosen date is after the statutory deadline", () => {
    const w = deadlineWarning("2026-11-20", "2026-11-15");
    expect(w).not.toBeNull();
    expect(w).toContain("15.11.2026");
  });

  it("says nothing when the date is on or before the deadline", () => {
    expect(deadlineWarning("2026-11-15", "2026-11-15")).toBeNull();
    expect(deadlineWarning("2026-11-01", "2026-11-15")).toBeNull();
  });

  it("says nothing for a task with no statutory deadline", () => {
    expect(deadlineWarning("2026-11-20", null)).toBeNull();
  });

  it("does not warn about back-dating", () => {
    // Recording a date for something already handled is legitimate, and the
    // warning is specifically about planning to be late.
    expect(deadlineWarning("2026-01-01", "2026-11-15")).toBeNull();
  });
});

describe("the assembled list", () => {
  const args = { templateId: "vat-reporting", todayIso: "2026-09-12", statutoryDueDate: "2026-11-15" };

  it("puts the legal date first, because it is the most useful thing on the list", () => {
    expect(deadlineOptions(args)[0].kind).toBe("official");
  });

  it("never offers a date that has already passed", () => {
    const opts = deadlineOptions({ ...args, statutoryDueDate: "2026-01-01" });
    for (const o of opts) expect(o.date >= args.todayIso).toBe(true);
  });

  it("collapses two options that land on the same day", () => {
    const dates = deadlineOptions(args).map((o) => o.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("keeps the better-sourced option when two collide", () => {
    // Statutory date exactly a week out: the "בעוד שבוע" pick would duplicate
    // it, and the one carrying a source is the one to keep.
    const opts = deadlineOptions({ ...args, statutoryDueDate: "2026-09-19" });
    const onThatDay = opts.filter((o) => o.date === "2026-09-19");
    expect(onThatDay).toHaveLength(1);
    expect(onThatDay[0].kind).toBe("official");
  });

  it("still offers the relative picks for a task with no legal date", () => {
    const opts = deadlineOptions({ ...args, templateId: "buy-domain", statutoryDueDate: null });
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.kind !== "official")).toBe(true);
  });
});

describe("one rule for which date a task shows", () => {
  it("keeps the legal date on a statutory task, whatever the user set", () => {
    // A personal target must never displace the law's date in the UI, or the
    // product would be quoting a deadline the authority does not recognise.
    const r = effectiveDeadline({
      personal: "2026-10-01",
      system: "2026-11-15",
      statutory: true,
    });
    expect(r.date).toBe("2026-11-15");
    expect(r.from).toBe("system");
  });

  it("uses the user's date on a task with no legal deadline", () => {
    const r = effectiveDeadline({
      personal: "2026-10-01",
      system: "2026-12-01",
      statutory: false,
    });
    expect(r.date).toBe("2026-10-01");
    expect(r.from).toBe("personal");
  });

  it("falls back to the personal date when the law's is not published yet", () => {
    // The annual return has no date until רשות המסים announces one.
    const r = effectiveDeadline({ personal: "2026-10-01", system: null, statutory: true });
    expect(r.date).toBe("2026-10-01");
    expect(r.from).toBe("personal");
  });

  it("reports no date rather than an empty string", () => {
    const r = effectiveDeadline({ personal: null, system: null, statutory: false });
    expect(r.date).toBeNull();
    expect(r.from).toBe("none");
  });

  it("treats undefined like null, since the column is optional on the row type", () => {
    const r = effectiveDeadline({ personal: undefined, system: "2026-11-15", statutory: false });
    expect(r.date).toBe("2026-11-15");
  });
});
