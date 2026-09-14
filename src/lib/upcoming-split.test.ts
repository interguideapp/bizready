import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alreadyPast, overdueStatutory, stillAhead } from "@/lib/compliance";

/**
 * "תשלומים קרובים" WAS SHOWING MISSED DEADLINES.
 *
 * computeUpcomingObligations returns past-due items too, sorted ascending — so
 * the earliest entries are the ones already missed. insights fed the money
 * panel obligations.slice(0, 3), which is therefore the three MOST overdue
 * filings, under a heading that says "upcoming payments", each with a date
 * already gone.
 *
 * The panel whose entire job is to say what money is about to leave was
 * presenting a missed deadline as a future one — on a page that opens with an
 * overdue banner. Two statements about one filing, one screen, opposite
 * tenses, and the reassuring one is the one a reader believes.
 *
 * The board did the split correctly, inline, twice. Now there is one
 * definition and three callers.
 */
const ob = (daysUntil: number, basis = "statutory", title = "דיווח") => ({
  daysUntil,
  basis,
  title,
});

describe("the split is exhaustive and has no overlap", () => {
  const all = [ob(-40), ob(-1), ob(0), ob(1), ob(90)];

  it("every obligation lands on exactly one side", () => {
    expect(stillAhead(all).length + alreadyPast(all).length).toBe(all.length);
    const ahead = new Set(stillAhead(all));
    expect(alreadyPast(all).some((o) => ahead.has(o))) .toBe(false);
  });

  it("due today counts as ahead, not as late", () => {
    // Matches the board's boundary and overdueStatutory's, so the three
    // surfaces cannot disagree about the day a filing is actually due.
    expect(stillAhead([ob(0)])).toHaveLength(1);
    expect(alreadyPast([ob(0)])).toHaveLength(0);
    expect(overdueStatutory([ob(0)])).toHaveLength(0);
  });

  it("yesterday counts as late on all three", () => {
    expect(alreadyPast([ob(-1)])).toHaveLength(1);
    expect(stillAhead([ob(-1)])).toHaveLength(0);
    expect(overdueStatutory([ob(-1)])).toHaveLength(1);
  });
});

describe("nothing overdue can reach a panel headed 'upcoming'", () => {
  it("the three cheapest entries to take are no longer the most overdue", () => {
    // The exact bug: ascending order, take the first three.
    const sorted = [ob(-90, "statutory", "מע״מ"), ob(-30), ob(-2), ob(5), ob(12), ob(40)];
    const shown = stillAhead(sorted).slice(0, 3);
    expect(shown.map((o) => o.daysUntil)).toEqual([5, 12, 40]);
    expect(shown.every((o) => o.daysUntil >= 0)).toBe(true);
  });

  it("shows nothing rather than something wrong when everything is late", () => {
    // An empty section is honest. The overdue banner above it is not silent.
    expect(stillAhead([ob(-3), ob(-9)])).toEqual([]);
  });
});

describe("the callers use the shared split, not their own comparison", () => {
  /**
   * Asserted at the source because the defect is a missing filter, and a
   * missing filter cannot be observed from outside the page: it renders three
   * plausible-looking rows either way.
   */
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it("insights filters the money panel to what is still ahead", () => {
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).toContain("stillAhead(obligations)");
    expect(page).not.toContain("nextPayments: obligations.slice");
  });

  it("the board uses the same two functions instead of inline comparisons", () => {
    const page = read("src/app/(app)/calendar/page.tsx");
    expect(page).toContain("alreadyPast(obligations)");
    expect(page).toContain("stillAhead(obligations)");
    expect(page).not.toMatch(/obligations\.filter\(\(o\) => o\.daysUntil/);
  });
});
