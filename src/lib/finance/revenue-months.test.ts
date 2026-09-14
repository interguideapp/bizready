import { describe, expect, it } from "vitest";
import {
  currentMonthRevenue,
  monthKey,
  revenueByMonth,
  trailingMonths,
} from "@/lib/finance/revenue-months";

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * insights built the current-month key as `${now.getFullYear()}-${now.getMonth()}`
 * — "2026-8" — against a map keyed off metric_date.slice(0, 7) — "2026-09".
 * 0-based versus 1-based, unpadded versus padded: it matched nothing, ever, in
 * any month and any timezone.
 *
 * The panel renders that figure as "מחזור החודש" and subtracts the fixed costs
 * from it for "נטו משוער", so a business with revenue read ₪0 turnover and a
 * net loss equal to its whole monthly cost, in red. And the panel only appears
 * once revenue exists — so the only people who could see it were the ones who
 * had actually earned something.
 *
 * Measured before fixing: sync_metrics had no revenue rows yet, so nothing was
 * on screen. Armed, not firing.
 */
const SEP = new Date("2026-09-14T09:00:00Z");

describe("the month key is the one the rows are keyed by", () => {
  it("is 1-based and zero-padded, matching metric_date.slice(0, 7)", () => {
    // The exact mismatch. Date months are 0-based; ISO dates are not.
    expect(monthKey(2026, 8)).toBe("2026-09");
    expect(monthKey(2026, 0)).toBe("2026-01");
    expect("2026-09-30".slice(0, 7)).toBe(monthKey(2026, 8));
  });

  it("pads single digits, which the broken version did not", () => {
    expect(monthKey(2026, 0)).not.toBe("2026-1");
  });
});

describe("current-month revenue actually finds the month", () => {
  const rows = [
    { metric_date: "2026-09-03", value: 4000 },
    { metric_date: "2026-09-20", value: 1500 },
    { metric_date: "2026-08-11", value: 900 },
  ];

  it("sums the rows in the month the user is in", () => {
    // The single assertion the old code could never satisfy.
    expect(currentMonthRevenue(revenueByMonth(rows), SEP)).toBe(5500);
  });

  it("does not bleed in an adjacent month", () => {
    expect(currentMonthRevenue(revenueByMonth(rows), SEP)).not.toBe(6400);
  });

  it("returns 0 for a month with nothing in it, not a wrong number", () => {
    const quiet = [{ metric_date: "2026-07-01", value: 7000 }];
    expect(currentMonthRevenue(revenueByMonth(quiet), SEP)).toBe(0);
  });
});

describe("the headline figure and the chart cannot disagree", () => {
  /**
   * They are two readings of one fact on one screen, which is the shape that
   * has produced every one-truth failure in this product. So they share the
   * key builder and this asserts the consequence.
   */
  const rows = [
    { metric_date: "2026-09-05", value: 2222 },
    { metric_date: "2026-04-05", value: 100 },
  ];

  it("the last bar of the chart equals the current-month headline", () => {
    const totals = revenueByMonth(rows);
    const points = trailingMonths(totals, 12, SEP);
    expect(points[points.length - 1].value).toBe(currentMonthRevenue(totals, SEP));
    expect(points[points.length - 1].value).toBe(2222);
  });

  it("the window ends on the current month and spans twelve", () => {
    const points = trailingMonths(revenueByMonth(rows), 12, SEP);
    expect(points).toHaveLength(12);
    expect(points[11]).toMatchObject({ year: 2026, month: 8 });
    expect(points[0]).toMatchObject({ year: 2025, month: 9 });
  });
});

describe("the month is Israel's, not the server's", () => {
  /**
   * At 01:00 on the 1st in Israel the UTC date is still the previous month, so
   * a server-clock reading labels the chart — and the headline — a month
   * behind for those hours. Asserted with a real instant rather than by
   * manipulating TZ, which is not honoured on this host: every value there
   * resolves to Asia/Bangkok, and that silently invalidated an earlier
   * timezone experiment in this codebase.
   */
  const justAfterIsraeliMidnight = new Date("2026-09-30T22:30:00Z"); // 01:30 on 1 Oct in Israel

  it("reads October once Israel is in October, though UTC is still September", () => {
    expect(justAfterIsraeliMidnight.getUTCMonth()).toBe(8); // September, UTC
    const rows = [
      { metric_date: "2026-10-01", value: 500 },
      { metric_date: "2026-09-28", value: 9000 },
    ];
    const totals = revenueByMonth(rows);
    expect(currentMonthRevenue(totals, justAfterIsraeliMidnight)).toBe(500);
    const points = trailingMonths(totals, 12, justAfterIsraeliMidnight);
    expect(points[11]).toMatchObject({ year: 2026, month: 9 }); // October
  });

  /**
   * AND THE CASE ABOVE IS NOT ENOUGH ON ITS OWN.
   *
   * One instant only separates Jerusalem from SOME host zones. It catches a
   * UTC reading on this machine (whose zone resolves to Asia/Bangkok) and
   * would catch nothing on a UTC runner, where UTC and the host agree. The
   * sibling test in income.test.ts passed with the defect planted for exactly
   * that reason, which is how this was noticed.
   *
   * So sweep the boundary, compute the expectation from Intl rather than from
   * the module under test, and assert the premise that some hour in the
   * window actually separates the two — otherwise the test reports itself as
   * proving nothing instead of passing.
   */
  const jerusalemMonth = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
    })
      .format(d)
      .slice(0, 7);

  it("agrees with Jerusalem at every hour across a month boundary", () => {
    const start = Date.parse("2026-09-30T00:00:00Z");
    let separatedFromUtc = 0;
    for (let h = 0; h < 48; h++) {
      const at = new Date(start + h * 3_600_000);
      const expected = jerusalemMonth(at);
      // A row in every candidate month, so the lookup has something to find
      // whichever month is chosen — otherwise a wrong month reads as 0 and
      // looks like "no revenue" rather than like the wrong month.
      const totals = revenueByMonth([
        { metric_date: "2026-09-15", value: 111 },
        { metric_date: "2026-10-15", value: 222 },
      ]);
      expect(currentMonthRevenue(totals, at), at.toISOString()).toBe(
        expected === "2026-09" ? 111 : 222
      );
      const points = trailingMonths(totals, 12, at);
      expect(monthKey(points[11].year, points[11].month), at.toISOString()).toBe(expected);
      const utcKey = monthKey(at.getUTCFullYear(), at.getUTCMonth());
      if (utcKey !== expected) separatedFromUtc++;
    }
    expect(
      separatedFromUtc,
      "no hour in this window separates UTC from Jerusalem, so this proves nothing"
    ).toBeGreaterThan(0);
  });
});
