import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alertHorizon, horizonSentence } from "@/lib/alert-horizon";
import { REMINDER_WINDOWS_RECOMMENDED } from "@/lib/compliance";

/**
 * A FALSE ALL-CLEAR PRODUCED BY THE FIX FOR A DIFFERENT PROBLEM.
 *
 * The alerts page's empty state names the horizon it checked, and that number
 * was Math.max of the plan's windows — 30 days on Pro. But the escalation had
 * deliberately been narrowed BY KIND: statutory filings and document expiries
 * keep the 30/14/7/1 runway, while a recommendation gets a single nudge at
 * seven days, because four nudges per suggestion across forty tasks is how an
 * alerts list becomes something people stop opening.
 *
 * So a Pro user with a recommended task twenty days out was told
 * "אין דדליין בחודש הקרוב" — and there was one. Not a wrong row: a wrong
 * all-clear, on the screen whose entire job is that nothing gets missed.
 *
 * The page's own docstring warns about this exact shape one level up: "an
 * empty list means nothing inside that horizon, not nothing at all". The copy
 * was updated for the plan's horizon and never for the per-kind one.
 */
describe("the horizon is per kind, because the escalation is", () => {
  it("Pro looks a month ahead for filings and a week for recommendations", () => {
    expect(alertHorizon(true)).toEqual({ statutory: 30, recommended: 7 });
  });

  it("free looks a week ahead for both", () => {
    expect(alertHorizon(false)).toEqual({ statutory: 7, recommended: 7 });
  });

  it("tracks the constant rather than restating it", () => {
    // A retyped 7 here would go stale the moment the narrowing is retuned.
    expect(alertHorizon(true).recommended).toBe(Math.max(...REMINDER_WINDOWS_RECOMMENDED));
  });
});

describe("the sentence is true of every kind", () => {
  it("names both horizons when they differ", () => {
    const text = horizonSentence(alertHorizon(true));
    expect(text).toContain("בחודש הקרוב");
    expect(text).toContain("בשבוע הקרוב");
  });

  it("does not claim a month of coverage for recommendations", () => {
    // The bug, stated as the thing the copy must never say again.
    const text = horizonSentence(alertHorizon(true));
    expect(text).not.toMatch(/^אין דדליין בחודש הקרוב$/);
  });

  it("collapses to one clause when the two coincide", () => {
    // A sentence that says the same thing twice reads as a mistake.
    const text = horizonSentence(alertHorizon(false));
    expect(text).toBe("אין דדליין בשבוע הקרוב");
    expect(text.match(/בשבוע הקרוב/g)).toHaveLength(1);
  });

  it("keeps the dual forms right, which is this codebase's recurring slip", () => {
    expect(horizonSentence({ statutory: 2, recommended: 1 })).toContain("ביומיים הקרובים");
    expect(horizonSentence({ statutory: 2, recommended: 1 })).toContain("ביום הקרוב");
  });
});

describe("the page uses it", () => {
  it("builds its empty state from the sentence, not from a single max", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(app)/notifications/page.tsx"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(page).toContain("horizonSentence(");
    // The shape of the over-promise.
    expect(page).not.toContain("Math.max(...windows)");
  });
});
