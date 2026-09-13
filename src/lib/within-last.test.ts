import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withinLastMs } from "@/lib/dates";

/**
 * The window that stops /plan-ready re-running the celebration.
 *
 * "התכנית מוכנה" used to render on every later visit to that route, which is
 * how an audit item got written about it. A one-hour window fixed it and
 * nothing asserted the window — the check lived inline in the page body,
 * reading the clock during render, where it was neither testable nor pure.
 */
const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-09-13T12:00:00Z");

describe("withinLastMs", () => {
  it("is true just inside the window", () => {
    expect(withinLastMs("2026-09-13T11:01:00Z", HOUR, NOW)).toBe(true);
  });

  it("is false just outside it", () => {
    expect(withinLastMs("2026-09-13T10:59:00Z", HOUR, NOW)).toBe(false);
  });

  it("includes the boundary itself", () => {
    expect(withinLastMs("2026-09-13T11:00:00Z", HOUR, NOW)).toBe(true);
  });

  it("treats a missing timestamp as not recent", () => {
    expect(withinLastMs(null, HOUR, NOW)).toBe(false);
  });

  it("treats an unparseable timestamp as not recent", () => {
    /**
     * A deliberate change from the inline version, which required
     * Number.isFinite before it would redirect — so an unreadable
     * onboarding_completed_at showed the celebration on EVERY visit, forever,
     * which is the bug the window was added to fix. Absent a readable date,
     * "not recent" is the answer that cannot loop.
     */
    expect(withinLastMs("not-a-date", HOUR, NOW)).toBe(false);
  });

  it("does not count a future timestamp as expired", () => {
    // Clock skew between the DB and the runtime must not skip the celebration
    // for someone who just finished onboarding.
    expect(withinLastMs("2026-09-13T12:05:00Z", HOUR, NOW)).toBe(true);
  });
});

describe("the celebration route uses it", () => {
  it("does not read the clock in its own render body", () => {
    // Asserted at the source: the helper being correct is worth nothing if the
    // page still does its own Date.now() comparison.
    const page = readFileSync(join(process.cwd(), "src/app/plan-ready/page.tsx"), "utf8");
    expect(page).toContain("withinLastMs(business.onboarding_completed_at");
    expect(page).not.toContain("Date.now()");
  });
});
