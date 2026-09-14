import { describe, expect, it } from "vitest";
import { buildIncomeMonths } from "./income";

describe("buildIncomeMonths", () => {
  const now = new Date(2026, 8, 15); // Sep 2026 (month index 8)

  it("returns the last N months oldest→newest, ending on the current month", () => {
    const months = buildIncomeMonths({}, 6, now);
    expect(months).toHaveLength(6);
    expect(months[0].key).toBe("2026-04");
    expect(months[5].key).toBe("2026-09");
    expect(months[5].label).toBe("ספטמבר 2026");
    expect(months.every((m) => m.amount === 0)).toBe(true);
  });

  it("seeds known amounts by yyyy-mm and leaves the rest at 0", () => {
    const months = buildIncomeMonths({ "2026-08": 12000, "2026-09": 4500 }, 6, now);
    expect(months.find((m) => m.key === "2026-08")!.amount).toBe(12000);
    expect(months.find((m) => m.key === "2026-09")!.amount).toBe(4500);
    expect(months.find((m) => m.key === "2026-07")!.amount).toBe(0);
  });

  it("crosses a year boundary correctly", () => {
    const months = buildIncomeMonths({}, 3, new Date(2026, 1, 10)); // Feb 2026
    expect(months.map((m) => m.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("the months offered are Israel's, because the user types into them", () => {
  /**
   * buildIncomeMonths read the HOST clock. Israel is UTC+2/+3, so from Israeli
   * midnight until 02:00/03:00 on the 1st a UTC server is still in the
   * previous month: the newest row offered was last month, and someone
   * entering "this month's income" filed it into the wrong one.
   *
   * These amounts are stored as manual_revenue and summed into both the
   * twelve-month chart and the עוסק פטור ceiling — the figure the product
   * actively warns people about. And this is the one screen where the user is
   * typing the number themselves, which makes a wrong month label the most
   * believable kind of wrong.
   */
  const israeliFirstOfOctober = new Date("2026-09-30T22:30:00Z"); // 01:30, 1 Oct in Israel

  it("the premise: UTC is still in September at that instant", () => {
    // Without this the test could pass for the wrong reason.
    expect(israeliFirstOfOctober.getUTCMonth()).toBe(8);
  });

  it("offers October as the newest month, not September", () => {
    const months = buildIncomeMonths({}, 6, israeliFirstOfOctober);
    expect(months[months.length - 1].key).toBe("2026-10");
    expect(months[months.length - 1].label).toBe("אוקטובר 2026");
  });

  /**
   * THE SINGLE INSTANT ABOVE IS NOT A GUARD, AND I PROVED IT.
   *
   * I planted the host-clock version back and all of these still passed,
   * because this host's zone resolves to Asia/Bangkok (UTC+7) — and at
   * 22:30Z on 30 September, Bangkok and Jerusalem are BOTH already in
   * October, so the two implementations agree and the assertion cannot tell
   * them apart. TZ is not honoured here, so it cannot be forced either; the
   * identical mistake already cost this codebase one wasted timezone
   * experiment.
   *
   * A zone-independent guard has to sweep the boundary instead of picking one
   * instant: across a full day either side of a month change, SOME instant
   * separates Jerusalem from any given host zone, and the expectation is
   * computed from Intl directly rather than from the module under test.
   */
  const jerusalemMonth = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
    })
      .format(d)
      .slice(0, 7);

  it("the newest month is Jerusalem's at every hour around a month boundary", () => {
    const start = Date.parse("2026-09-30T00:00:00Z");
    let separated = 0;
    for (let h = 0; h < 48; h++) {
      const at = new Date(start + h * 3_600_000);
      const months = buildIncomeMonths({}, 6, at);
      expect(months[months.length - 1].key, at.toISOString()).toBe(jerusalemMonth(at));
      // Count the hours where the host would have answered differently, so a
      // host zone that happens to agree everywhere fails the premise below
      // instead of passing this vacuously.
      const hostKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
      if (hostKey !== jerusalemMonth(at)) separated++;
    }
    expect(
      separated,
      "no hour in this window separates the host zone from Jerusalem, so this test proves nothing here"
    ).toBeGreaterThan(0);
  });

  it("seeds each row from the key it will be saved under", () => {
    // A label that says one month while the key says another is how a figure
    // lands in the wrong bucket without anyone noticing.
    const months = buildIncomeMonths({ "2026-10": 4200 }, 6, israeliFirstOfOctober);
    expect(months[months.length - 1].amount).toBe(4200);
  });

  it("keys match the format the revenue map buckets by", () => {
    // 1-based and zero-padded, like metric_date.slice(0, 7). The mismatch
    // between these two spellings is what made "מחזור החודש" permanently ₪0.
    for (const m of buildIncomeMonths({}, 6, israeliFirstOfOctober)) {
      expect(m.key).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});
