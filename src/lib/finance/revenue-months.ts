import { israelParts } from "@/lib/dates";

/**
 * Bucketing revenue rows into months, and naming the current one.
 *
 * This lived inline in the insights page and was wrong in a way no screenshot
 * would show: the map was keyed "2026-09" (1-based, zero-padded, straight off
 * metric_date) while the current-month lookup built "2026-8" (0-based,
 * unpadded, from the SERVER's clock). It could never match any key, for any
 * month, in any timezone — so the figure was always 0.
 *
 * "Always 0" is not a blank here. The finance panel renders it as
 * "מחזור החודש" and subtracts the fixed costs from it for "נטו משוער", so a
 * business with revenue was told its turnover this month was nothing and its
 * net was a loss equal to its entire monthly costs, in red. It only appears
 * once revenue exists, which means the users who could see it were exactly the
 * users who had earned something.
 *
 * One spelling of a month key, used by every caller, is the fix — the same
 * remedy applied to statutory dates, overdue counting and delivery health:
 * the second way of computing one value is where the wrong answer hides.
 */

/** `2026-09`. Month is 0-based, matching Date and israelParts. */
export function monthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export interface RevenueRow {
  /** `YYYY-MM-DD`. Sliced, never parsed: see the note in insights. */
  metric_date: string;
  value: number;
}

/**
 * Total per month, keyed by monthKey.
 *
 * Sliced rather than parsed on purpose. A parse is one keystroke from the
 * shift that has been live elsewhere in this codebase (parse as UTC, read in
 * the ambient zone), and revenue landing in the wrong month feeds the
 * עוסק פטור ceiling calculation.
 */
export function revenueByMonth(rows: RevenueRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.metric_date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + row.value);
  }
  return totals;
}

/**
 * The trailing `count` months ending on the CURRENT ISRAELI month.
 *
 * The server's month is not the user's: at 01:00 on the 1st in Israel the
 * server is still in the previous month, and the chart would have been
 * labelled a month behind for those hours.
 */
export function trailingMonths(
  totals: Map<string, number>,
  count: number,
  now: Date = new Date()
): { year: number; month: number; value: number }[] {
  const here = israelParts(now);
  const points: { year: number; month: number; value: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(here.year, here.month - i, 1));
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth();
    points.push({ year, month, value: totals.get(monthKey(year, month)) ?? 0 });
  }
  return points;
}

/**
 * Revenue in the month the user is currently in.
 *
 * Reads the same map, through the same key builder, as the chart — so the
 * headline figure and the last bar of the chart cannot disagree, which is a
 * thing a reader would notice on one screen.
 */
export function currentMonthRevenue(
  totals: Map<string, number>,
  now: Date = new Date()
): number {
  const here = israelParts(now);
  return totals.get(monthKey(here.year, here.month)) ?? 0;
}
