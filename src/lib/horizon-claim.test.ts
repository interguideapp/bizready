import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horizonLabel } from "@/lib/he-distance";
import { REMINDER_WINDOWS_FREE, REMINDER_WINDOWS_PRO } from "@/lib/compliance";
import { computeReminders } from "@/lib/reminders";
import { TEMPLATES_BY_ID } from "@/lib/content";

/**
 * The alerts list may not report an all-clear it did not check for.
 *
 * computeReminders raises a deadline item only once a reminder window is
 * crossed: seven days on the free plan, thirty on Pro. So an empty list means
 * "nothing inside that horizon" — and the empty state said
 * "אין דדליין מתקרב, אין איחור ואין תקופת דיווח חדשה".
 *
 * Measured, not argued. A free business whose VAT filing is due 15 September,
 * asked on 26 August, gets ZERO drafts while Pro gets the 30-day nudge. The
 * product therefore told that business there was no approaching deadline three
 * weeks before a statutory filing. That is the A2 shape — an absence of data
 * rendered as a clean bill of health — on the one screen whose whole job is
 * that nothing gets missed, and it was false on Pro too, past thirty days.
 *
 * The claim now names its own horizon.
 */
const VAT = "vat-reporting";
const VAT_FILE = "open-vat-file";

function tasks() {
  return [
    {
      id: "a",
      template_id: VAT_FILE,
      status: "done" as const,
      is_relevant: true,
      due_date: null,
      completed_at: "2026-01-05T09:00:00Z",
      completion_data: null,
    },
    {
      id: "b",
      template_id: VAT,
      status: "todo" as const,
      is_relevant: true,
      due_date: "2026-09-15",
      completed_at: null,
      completion_data: null,
    },
  ];
}

const TWENTY_DAYS_OUT = new Date("2026-08-26T09:00:00Z");

describe("the gap that made the old sentence false", () => {
  it("gives a free business no alert twenty days before a statutory filing", () => {
    const free = computeReminders(tasks(), TEMPLATES_BY_ID, TWENTY_DAYS_OUT, false, {
      vatFrequency: "bimonthly",
    });
    expect(free.notifications).toEqual([]);
  });

  it("while Pro gets the thirty-day nudge for the very same business", () => {
    const pro = computeReminders(tasks(), TEMPLATES_BY_ID, TWENTY_DAYS_OUT, true, {
      vatFrequency: "bimonthly",
    });
    expect(pro.notifications.map((n) => n.dedupe_key)).toContain(
      "deadline:vat-reporting:2026-09-15:30"
    );
  });
});

describe("horizonLabel names the span that was checked", () => {
  it("uses natural spans for the two real horizons", () => {
    expect(horizonLabel(Math.max(...REMINDER_WINDOWS_FREE))).toBe("בשבוע הקרוב");
    expect(horizonLabel(Math.max(...REMINDER_WINDOWS_PRO))).toBe("בחודש הקרוב");
  });

  it("never pairs a numeral 1 or 2 with a plural noun, at any horizon", () => {
    // The recurring Hebrew defect here, now fixed in six separate noun pairs.
    for (let d = 1; d <= 400; d++) {
      expect(horizonLabel(d), String(d)).not.toMatch(/ב-1 |ב-2 |1 ימים|1 שבועות|1 חודשים/);
    }
  });

  it("uses the dual for two days and two weeks and two months", () => {
    expect(horizonLabel(2)).toBe("ביומיים הקרובים");
    expect(horizonLabel(14)).toBe("בשבועיים הקרובים");
    expect(horizonLabel(60)).toBe("בחודשיים הקרובים");
  });

  it("falls back to plain days for an unusual span", () => {
    expect(horizonLabel(45)).toBe("ב-45 הימים הקרובים");
  });
});

describe("the empty state says it", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(app)/notifications/page.tsx"),
    "utf8"
  );
  const shipped = page
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("scopes the claim rather than asserting nothing is approaching", () => {
    /*
     * The sentence moved into lib/alert-horizon.ts and this assertion failed,
     * which is the point of a source-level guard. What it protects is
     * unchanged: the claim must name a horizon rather than assert a general
     * all-clear.
     *
     * Why it moved: naming ONE horizon was itself false on Pro. The
     * escalation had been narrowed by kind — statutory filings and expiries
     * keep 30/14/7/1, a recommendation gets a single nudge at seven days —
     * so "אין דדליין בחודש הקרוב" was said to Pro users who had a recommended
     * task twenty days out. A false all-clear produced by the fix for a
     * different problem, in the copy this very test was written to correct.
     */
    expect(shipped).toContain("horizonSentence(");
    expect(shipped).not.toContain("אין דדליין מתקרב");
  });

  it("derives the horizon from the engine's windows, not from a literal", () => {
    // Hardcoding 7 or 30 anywhere would drift from the windows the engine
    // uses. alert-horizon.ts reads the constants; the page reads that.
    const horizon = readFileSync(
      join(process.cwd(), "src/lib/alert-horizon.ts"),
      "utf8"
    );
    expect(horizon).toContain("REMINDER_WINDOWS_PRO");
    expect(horizon).toContain("REMINDER_WINDOWS_FREE");
    expect(horizon).toContain("REMINDER_WINDOWS_RECOMMENDED");
    expect(shipped).toContain("alertHorizon(isPro(business))");
  });

  it("does not name a single horizon, which was the over-promise", () => {
    // Pro's statutory horizon applied to recommendations is the exact claim
    // that was false.
    expect(shipped).not.toContain("Math.max(...windows)");
  });

  it("points at the surface that does show everything dated", () => {
    // Otherwise a scoped all-clear leaves the reader with nowhere to look.
    expect(shipped).toMatch(/לוח החובות/);
  });
});
