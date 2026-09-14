import { describe, expect, it } from "vitest";
import {
  alreadyPast,
  computeUpcomingObligations,
  overdueStatutory,
  stillAhead,
  type ComplianceTask,
} from "@/lib/compliance";
import { boardWindow } from "@/lib/board-window";
import { TEMPLATES_BY_ID } from "@/lib/content";

/**
 * THE SECTIONS PARTITION THE OBLIGATIONS: nothing twice, nothing dropped.
 *
 * Every section of the obligations board is unit-tested on its own. The
 * COMPOSITION is not, and the composition is what the user reads: five
 * sections built from five separate filters over one list. Two failures are
 * possible and neither is visible in a section test.
 *
 * An obligation in two sections is a duplicate row — the same VAT period
 * appearing as late at the top and again in the month timeline, which makes a
 * reader doubt everything else on the screen.
 *
 * An obligation in NO section is worse and is the failure this product exists
 * to prevent: the engine knows about it, the board received it, and no filter
 * claimed it, so it is silently absent while the screen looks complete.
 *
 * The filters are overdue / lapsed / upcoming, and the invariant is that they
 * cover the engine's output exactly once each.
 */
const TODAY = new Date("2026-09-14T09:00:00Z");

function task(over: Partial<ComplianceTask>): ComplianceTask {
  return {
    template_id: "vat-reporting",
    status: "todo",
    is_relevant: true,
    completed_at: null,
    dismissal: null,
    completion_data: null,
    due_date: null,
    filed_periods: [],
    ...over,
  } as ComplianceTask;
}

/**
 * A business with one of everything the board can show at once: a VAT filing
 * running late, an annual report ahead, a renewal that has lapsed, and an
 * expiring document.
 */
function busyObligations() {
  const tasks: ComplianceTask[] = [
    task({ template_id: "open-vat-file", status: "done", completed_at: "2026-01-05T09:00:00Z" }),
    task({ template_id: "open-income-tax-file", status: "done", completed_at: "2026-01-05T09:00:00Z" }),
    task({ template_id: "vat-reporting", due_date: "2026-07-15" }),
    task({ template_id: "income-tax-advances", due_date: "2026-09-15" }),
    task({ template_id: "annual-tax-report", due_date: "2027-04-30" }),
    task({
      template_id: "professional-liability-insurance",
      status: "done",
      completed_at: "2025-08-01T09:00:00Z",
      completion_data: { renewal: "2026-08-01" },
    }),
  ];
  return computeUpcomingObligations(
    tasks,
    TEMPLATES_BY_ID,
    [
      { name: "אישור ניהול ספרים", expires_at: "2026-09-25" },
      { name: "תעודת ביטוח", expires_at: "2026-06-01" },
      // Expiring EXACTLY today, which is the only instant at which the
      // late/ahead split can overlap or gap. Without a row here the partition
      // assertion never reaches the boundary it exists to check.
      { name: "רישיון עסק", expires_at: "2026-09-14" },
    ],
    TODAY,
    { entityType: "osek_murshe", vatFrequency: "bimonthly" }
  );
}

describe("the three date filters cover the engine's output exactly once", () => {
  const obligations = busyObligations();

  it("the premise: this fixture really produces a mixed board", () => {
    // Without late AND ahead AND non-statutory entries, the partition would be
    // trivially satisfied and prove nothing.
    expect(obligations.length).toBeGreaterThan(3);
    expect(alreadyPast(obligations).length).toBeGreaterThan(0);
    expect(stillAhead(obligations).length).toBeGreaterThan(0);
    expect(obligations.some((o) => o.basis !== "statutory")).toBe(true);
  });

  it("the premise that matters: something is due EXACTLY today", () => {
    /*
     * MY FIRST VERSION OF THIS FILE HAD NO SUCH ROW, and all three planted
     * boundary regressions passed.
     *
     * Overlap and gap can only happen at daysUntil === 0 — one filter taking
     * it as well as the other, or neither taking it. With nothing due today
     * the partition assertion never reached the boundary and certified a
     * split it had not examined. Same shape as every guard this codebase has
     * had to strengthen: it could not observe the defect it was written for.
     */
    expect(obligations.some((o) => o.daysUntil === 0), "nothing due today").toBe(true);
  });

  it("what is due today is in the forward list, and only there", () => {
    // Stated separately from the partition so the failure names the cause.
    const dueToday = obligations.filter((o) => o.daysUntil === 0);
    expect(dueToday.length).toBeGreaterThan(0);
    const aheadIds = new Set(stillAhead(obligations).map((o) => o.id));
    const pastIds = new Set(alreadyPast(obligations).map((o) => o.id));
    for (const o of dueToday) {
      expect(aheadIds.has(o.id), o.id + " missing from upcoming").toBe(true);
      expect(pastIds.has(o.id), o.id + " also counted as late").toBe(false);
    }
  });

  it("every obligation lands in exactly one of overdue / lapsed / upcoming", () => {
    const pastDue = alreadyPast(obligations);
    const overdue = overdueStatutory(obligations);
    const lapsed = pastDue.filter((o) => o.basis !== "statutory");
    const upcoming = stillAhead(obligations);

    const counts = new Map<string, number>();
    for (const list of [overdue, lapsed, upcoming]) {
      for (const o of list) counts.set(o.id, (counts.get(o.id) ?? 0) + 1);
    }

    const shownTwice = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
    expect(shownTwice, "an obligation appears in two sections").toEqual([]);

    const shownNever = obligations.filter((o) => !counts.has(o.id)).map((o) => o.id);
    expect(shownNever, "an obligation appears in no section at all").toEqual([]);
  });

  it("a lapsed renewal is never also counted as an overdue filing", () => {
    // The distinction the board exists to keep: interest accrues on a missed
    // VAT period and not on an expired policy, so the two must not overlap.
    const overdueIds = new Set(overdueStatutory(obligations).map((o) => o.id));
    const lapsed = alreadyPast(obligations).filter((o) => o.basis !== "statutory");
    for (const o of lapsed) expect(overdueIds.has(o.id), o.id).toBe(false);
  });
});

describe("the paywalled window never drops a late obligation", () => {
  /**
   * Being late is not a premium feature, and the gate applies to the FORWARD
   * list only. If boardWindow were ever handed the whole set, a free user's
   * overdue filings would vanish behind the paywall — the single most
   * expensive regression this screen can have.
   */
  const obligations = busyObligations();

  it("the premise: there is something late to lose", () => {
    expect(alreadyPast(obligations).length).toBeGreaterThan(0);
  });

  it("the free window is exactly the nearest month, computed independently", () => {
    /*
     * MY FIRST VERSION COMPARED hidden.length WITH free.hiddenCount, and both
     * are derived from free.visible — so the assertion held whatever window
     * boardWindow returned. Slicing the SECOND month instead of the first
     * passed it. A guard whose two sides come from one value proves only that
     * the value equals itself.
     *
     * The expectation is now built here, from the obligations, without asking
     * boardWindow anything.
     */
    const upcoming = stillAhead(obligations);
    const nearestKey = (() => {
      const d = new Date(upcoming[0].dueDate + "T00:00:00Z");
      return d.getUTCFullYear() + "-" + d.getUTCMonth();
    })();
    const expected = upcoming
      .filter((o) => {
        const d = new Date(o.dueDate + "T00:00:00Z");
        return d.getUTCFullYear() + "-" + d.getUTCMonth() === nearestKey;
      })
      .map((o) => o.id);
    expect(expected.length).toBeGreaterThan(0);

    const free = boardWindow(upcoming, false);
    expect(free.visible.map((o) => o.id)).toEqual(expected);
    // And the remainder is counted rather than silently gone.
    expect(free.hiddenCount).toBe(upcoming.length - expected.length);
  });

  it("nothing late is ever inside the paywalled window", () => {
    // The gate applies to the forward list only. Being late is not a premium
    // feature, and this is the most expensive regression this screen can have.
    const free = boardWindow(stillAhead(obligations), false);
    const lateIds = new Set(alreadyPast(obligations).map((o) => o.id));
    for (const o of free.visible) expect(lateIds.has(o.id), o.id).toBe(false);
  });

  it("and Pro loses nothing at all", () => {
    const upcoming = stillAhead(obligations);
    const pro = boardWindow(upcoming, true);
    expect(pro.hiddenCount).toBe(0);
    expect(pro.visible.length).toBe(upcoming.length);
  });
});
