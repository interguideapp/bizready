import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { revenueCoverage } from "@/lib/finance/ceiling";

/**
 * How current the revenue behind a ceiling reading is.
 *
 * The עוסק פטור ceiling decides a legal fact — over it, registration for מע״מ
 * is required — and the percentage was rendered with no indication of the
 * data's age. revenueYtd is summed from sync_metrics, which the nightly sync
 * fills, and that sync has NO fallback: lazy-sweep runs reminders only, so
 * when the schedule is dead the figure is whatever was last pulled by hand.
 *
 * A business genuinely over the ceiling could therefore read 78% off
 * three-month-old data and conclude it had room. A stale number presented as a
 * current one is worse than no number, because it gets acted upon.
 */
const SEPT = "2026-09-13";

describe("what counts as up to date", () => {
  it("treats the current month as current", () => {
    expect(revenueCoverage("2026-09", SEPT)).toEqual({ monthsBehind: 0, behind: false });
  });

  it("treats last month as current, because this month is still running", () => {
    // On 3 September, coverage through August is simply up to date — flagging
    // it would fire every month and become wallpaper.
    expect(revenueCoverage("2026-08", SEPT)).toEqual({ monthsBehind: 1, behind: false });
  });

  it("flags a month that should have arrived and has not", () => {
    expect(revenueCoverage("2026-07", SEPT)).toEqual({ monthsBehind: 2, behind: true });
  });

  it("counts across a year boundary", () => {
    expect(revenueCoverage("2025-11", SEPT)).toMatchObject({ monthsBehind: 10, behind: true });
  });

  it("does not report future-dated data as behind", () => {
    expect(revenueCoverage("2026-12", SEPT)).toEqual({ monthsBehind: 0, behind: false });
  });

  it("says nothing when there is no revenue at all", () => {
    // The panel only renders with revenue, but a null must not become "behind
    // by 2026 months".
    expect(revenueCoverage(null, SEPT)).toBeNull();
    expect(revenueCoverage("", SEPT)).toBeNull();
  });

  it("says nothing for an unparseable value rather than guessing", () => {
    expect(revenueCoverage("not-a-month", SEPT)).toBeNull();
  });

  it("accepts a full date and reads its month", () => {
    // metric_date rows are full dates; the caller slices, but the boundary
    // should not depend on that.
    expect(revenueCoverage("2026-07-31", SEPT)).toMatchObject({ behind: true });
  });
});

describe("the panel says where the percentage came from", () => {
  const panel = readFileSync(
    join(process.cwd(), "src/components/finance/finance-panels.tsx"),
    "utf8"
  );
  const page = readFileSync(
    join(process.cwd(), "src/app/(app)/insights/page.tsx"),
    "utf8"
  );

  it("computes the coverage rather than assuming currency", () => {
    expect(panel).toContain("revenueCoverage(d.revenueThroughMonth, d.todayIso)");
  });

  it("warns when the figure is behind, and says the percentage may understate", () => {
    const from = panel.indexOf("coverage?.behind && d.revenueThroughMonth");
    expect(from).toBeGreaterThan(-1);
    const block = panel.slice(from, from + 1200);
    expect(block).toContain("גבוהים יותר");
    expect(block).toContain("כדאי לסנכרן");
  });

  it("still states the coverage quietly when it is current", () => {
    // Provenance always, alarm only when warranted.
    expect(panel).toContain("!coverage?.behind && d.revenueThroughMonth");
  });

  it("is fed the real latest month by the page", () => {
    expect(page).toContain("revenueThroughMonth: revenueMonths.length > 0");
    // Derived from the metric rows, so a hand-logged month counts the same as
    // a synced one and no extra query is needed.
    expect(page).toContain("m.metric_date.slice(0, 7)");
  });

  it("judges the age against the Israeli day", () => {
    expect(page).toContain("todayIso: todayInIsrael(now)");
  });
});
