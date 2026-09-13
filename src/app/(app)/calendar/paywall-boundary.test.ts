import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where the obligations board's paywall is allowed to fall.
 *
 * The page says it in a comment — "Late first, never behind the paywall: being
 * late is not a premium feature, and this is the section the whole page exists
 * for" — and a comment stops nothing. Moving OverdueSection into a conditional
 * would typecheck, render, and leave every other test green, while a free user
 * stopped being shown what they are already late for. That is the most
 * expensive single regression this screen can have.
 *
 * So the boundary is asserted at the source: the gate may narrow the FUTURE
 * timeline and nothing else.
 */
const page = readFileSync(join(process.cwd(), "src/app/(app)/calendar/page.tsx"), "utf8");

/** The sections that must never be gated, and the array each is handed. */
const UNGATED: Array<[string, string]> = [
  ["OverdueSection", "overdue={overdue}"],
  ["LapsedSection", "lapsed={lapsed}"],
  ["BlockedFilingsSection", "blocked={blockedFilings"],
  ["PendingFilingsSection", "pending={pendingFilings"],
  ["PersonalTargetsSection", "targets={personalTargets}"],
];

describe("the paywall narrows the future timeline, and nothing else", () => {
  it("renders every consequence section unconditionally", () => {
    /**
     * Anchored on the empty-state ternary, not on visibleMonths.map.
     *
     * The first version of this compared against visibleMonths.map and PASSED
     * when I planted OverdueSection inside the paywalled fragment: that
     * fragment opens well above the .map, so a position relative to it says
     * nothing about nesting. Everything conditional on this page begins at
     * "obligations.length === 0", so being above THAT is what actually means
     * "rendered no matter what".
     */
    const conditionalFrom = page.indexOf("obligations.length === 0");
    expect(conditionalFrom).toBeGreaterThan(-1);
    for (const [section] of UNGATED) {
      const at = page.indexOf(`<${section}`);
      expect(at, `${section} is not rendered at all`).toBeGreaterThan(-1);
      expect(
        at,
        `${section} moved into a conditional branch — a free user, or one whose ` +
          `future list is empty, would stop seeing it`
      ).toBeLessThan(conditionalFrom);
    }
  });

  it("keeps them at the top level of the returned JSX", () => {
    // A second, independent reading of the same property: nesting shows up as
    // indentation, and six spaces is the top level of this return. Counted by
    // walking back over spaces rather than splitting on a newline, because
    // every attempt to write an escape sequence into this file through the
    // shell lost a backslash level — twice, silently.
    for (const [section] of UNGATED) {
      const at = page.indexOf(`<${section}`);
      let indent = 0;
      while (page[at - 1 - indent] === " ") indent++;
      expect(indent, `<${section}> is nested ${indent} spaces deep`).toBe(6);
    }
  });

  it("hands each of them its complete list", () => {
    // A subtler regression than moving the section: keeping it where it is and
    // passing a truncated array.
    for (const [section, prop] of UNGATED) {
      expect(page, `${section} no longer gets its full list`).toContain(prop);
    }
  });

  it("slices only the month grouping", () => {
    expect(page).toContain("pro ? allMonths : allMonths.slice(0, 1)");
    for (const name of [
      "overdue",
      "lapsed",
      "blockedFilings",
      "pendingFilings",
      "personalTargets",
    ]) {
      expect(page, `${name} is being truncated`).not.toContain(`${name}.slice(`);
    }
  });

  it("decides the gate on the server, before serialisation", () => {
    // The original paywall shipped every row and hid it with blur-sm, so it
    // was defeated by deleting one class and leaked wholesale to screen
    // readers. visibleMonths must be what the JSX iterates.
    expect(page).not.toContain("blur-sm");
    expect(page).not.toContain("allMonths.map");
  });
});
