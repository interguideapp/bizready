/**
 * How much of the forward obligations list a given plan may see — decided once.
 *
 * The obligations board gates this on the SERVER, deliberately: a free plan
 * gets the nearest month and the rest never reaches the browser, so there is
 * no CSS class to delete and nothing for a screen reader to read out. That was
 * A6 in the audit, and it was fixed properly.
 *
 * Then /insights rendered its own forward timeline — the same obligations, up
 * to eight of them, across any month — with no tier check at all. The gated
 * data left by a second door, which makes the board's careful server-side
 * gating theatre. And the timeline's footer said "עוד N בלוח החובות המלא", a
 * link that for a free user leads to a board showing one month: the page
 * advertised what its own target withholds.
 *
 * So the window is a function. Both surfaces ask it, neither decides for
 * itself, and a third surface added later gets the same answer for free.
 *
 * The grouping key is month-precise rather than a day count on purpose: "the
 * nearest month" is what the board's headings are, and a rolling 30 days would
 * cut a month in half and make the hidden-count copy unexplainable.
 */

export interface MonthGroup<T> {
  /** `2026-8` — year and 0-based month, matching Date and the MONTHS array. */
  key: string;
  year: number;
  /** 0-based, so it indexes a month-name array directly. */
  month: number;
  items: T[];
}

export interface BoardWindow<T> {
  /** Month groups this plan may see, nearest first. */
  months: MonthGroup<T>[];
  /** Everything in those groups, flattened — what may be shown anywhere. */
  visible: T[];
  /** Obligations withheld. Never the total: the visible month is not hidden. */
  hiddenCount: number;
  /** Months withheld, for copy that says "and N more months". */
  hiddenMonthCount: number;
}

/**
 * Group by month and cut to what the plan allows.
 *
 * `upcoming` must already be the forward-only list in ascending date order —
 * which is what stillAhead over computeUpcomingObligations gives, since the
 * engine sorts by ISO date. Insertion order is therefore chronological, which
 * is what makes "the nearest month" the first group without a re-sort.
 */
export function boardWindow<T extends { dueDate: string }>(
  upcoming: T[],
  pro: boolean
): BoardWindow<T> {
  const byMonth = new Map<string, MonthGroup<T>>();
  for (const ob of upcoming) {
    // Parsed at UTC midnight and read back in UTC: a plain YYYY-MM-DD has no
    // zone, and this is the one reading of it that cannot shift.
    const d = new Date(ob.dueDate + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const key = `${year}-${month}`;
    const group = byMonth.get(key) ?? { key, year, month, items: [] };
    group.items.push(ob);
    byMonth.set(key, group);
  }
  const all = [...byMonth.values()];
  const months = pro ? all : all.slice(0, 1);
  const visible = months.flatMap((m) => m.items);
  return {
    months,
    visible,
    hiddenCount: upcoming.length - visible.length,
    hiddenMonthCount: all.length - months.length,
  };
}
