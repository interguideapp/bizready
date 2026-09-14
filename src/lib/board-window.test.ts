import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boardWindow } from "@/lib/board-window";

/**
 * THE PAYWALL LEAK.
 *
 * The obligations board gates its forward list to the nearest month on the
 * server, so gated rows never reach the browser — that is what made the A6 fix
 * real rather than a CSS blur that survives deleting one class.
 *
 * /insights then rendered its own forward timeline over the same obligations,
 * up to eight of them, across any month, with NO tier check anywhere on the
 * page. The gated data left by a second door. Its footer then said "עוד N
 * בלוח החובות המלא" — a link that, for a free user, leads to a board showing
 * one month: the page advertised what its own target withholds.
 *
 * One decision, both callers, and the properties that matter asserted here.
 */
const ob = (dueDate: string, id = dueDate) => ({ dueDate, id });

describe("a free plan sees exactly the nearest month", () => {
  const upcoming = [
    ob("2026-09-15"),
    ob("2026-09-28"),
    ob("2026-10-02"),
    ob("2026-11-20"),
  ];

  it("shows the first month's items and withholds the rest", () => {
    const w = boardWindow(upcoming, false);
    expect(w.visible.map((o) => o.id)).toEqual(["2026-09-15", "2026-09-28"]);
    expect(w.months).toHaveLength(1);
  });

  it("counts the hidden obligations, not the total", () => {
    // The copy used to advertise obligations.length — including the month the
    // user could already see.
    const w = boardWindow(upcoming, false);
    expect(w.hiddenCount).toBe(2);
    expect(w.hiddenMonthCount).toBe(2);
  });

  it("hides nothing when everything falls in the nearest month", () => {
    const w = boardWindow([ob("2026-09-15"), ob("2026-09-28")], false);
    expect(w.hiddenCount).toBe(0);
    expect(w.hiddenMonthCount).toBe(0);
  });

  it("survives an empty list without inventing a month", () => {
    const w = boardWindow([], false);
    expect(w.months).toEqual([]);
    expect(w.visible).toEqual([]);
    expect(w.hiddenCount).toBe(0);
  });
});

describe("Pro sees all of it", () => {
  it("withholds nothing and groups every month", () => {
    const w = boardWindow([ob("2026-09-15"), ob("2026-10-02"), ob("2026-11-20")], true);
    expect(w.visible).toHaveLength(3);
    expect(w.months).toHaveLength(3);
    expect(w.hiddenCount).toBe(0);
  });
});

describe("the grouping itself", () => {
  it("keeps months in chronological order, nearest first", () => {
    // Insertion order carries this, because the engine sorts by ISO date. The
    // key is 0-based and unpadded, so a lexical sort of these keys would put
    // October before September — hence year and month live on the group
    // object and no caller re-parses the key.
    const w = boardWindow([ob("2026-09-15"), ob("2026-10-02"), ob("2027-01-05")], true);
    expect(w.months.map((m) => [m.year, m.month])).toEqual([
      [2026, 8],
      [2026, 9],
      [2027, 0],
    ]);
  });

  it("separates the same month in different years", () => {
    const w = boardWindow([ob("2026-09-15"), ob("2027-09-15")], true);
    expect(w.months).toHaveLength(2);
  });

  it("reads a plain date without a timezone shift", () => {
    // A YYYY-MM-DD has no zone. Parsed at UTC midnight and read back in UTC is
    // the one reading that cannot move the last day of a month into the next.
    const w = boardWindow([ob("2026-09-30"), ob("2026-10-01")], true);
    expect(w.months.map((m) => m.month)).toEqual([8, 9]);
    expect(w.months[0].items).toHaveLength(1);
  });
});

describe("both surfaces ask, neither decides", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it("the board gates through boardWindow", () => {
    expect(read("src/app/(app)/calendar/page.tsx")).toContain("boardWindow(upcoming, pro)");
  });

  it("insights gates its timeline through the same function", () => {
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).toContain("boardWindow(stillAhead(obligations), isPro(business))");
    // The shape of the leak: the raw list straight into the timeline.
    expect(page).not.toContain("obligations.slice(0, 8)");
  });

  it("insights still shows what is already late, ungated", () => {
    // Being late is not a premium feature — the same rule the board's overdue
    // section follows, and the most expensive thing to get wrong here.
    expect(read("src/app/(app)/insights/page.tsx")).toContain("alreadyPast(obligations)");
  });

  it("the footer counts what this page can actually link to", () => {
    // It said "עוד N בלוח החובות המלא" from the ungated total, so a free user
    // was told about rows the board would not show them.
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).not.toMatch(/obligations\.length - 8/);
    expect(page).toContain("timeline.length - 8");
  });
});
