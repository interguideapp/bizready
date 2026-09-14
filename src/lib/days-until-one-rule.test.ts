import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysUntilInIsrael, todayInIsrael } from "@/lib/dates";

/**
 * ONE ANSWER TO "IS THIS LATE?".
 *
 * compliance.ts and reminders.ts each held a byte-identical copy of the day
 * count. They had not drifted — which is the only reason this is a
 * consolidation and not a bug report. STATUTORY_FILINGS, ConfidenceState and
 * the score credit rule were each declared twice in this codebase too, and the
 * third of those HAD drifted, with the tested copy disagreeing with the one
 * that ran.
 *
 * These are the two modules that must never disagree: the obligations board
 * reads compliance.ts, the sweep reads reminders.ts, and one_truth.test.ts
 * exists because the way this design actually breaks is not the logic
 * diverging but one side being fed something different. A second copy of the
 * arithmetic is one edit from exactly that, silently, with every test green.
 */
describe("the count itself", () => {
  const NOW = new Date("2026-09-14T09:00:00Z");

  it("is zero for today", () => {
    expect(daysUntilInIsrael(todayInIsrael(NOW), NOW)).toBe(0);
  });

  it("is positive ahead and negative behind", () => {
    expect(daysUntilInIsrael("2026-09-15", NOW)).toBe(1);
    expect(daysUntilInIsrael("2026-09-13", NOW)).toBe(-1);
  });

  it("counts whole days across a month and a year boundary", () => {
    expect(daysUntilInIsrael("2026-10-14", NOW)).toBe(30);
    expect(daysUntilInIsrael("2027-09-14", NOW)).toBe(365);
  });

  it("ignores a time component on the input", () => {
    // Callers pass completed_at and other timestamps through this.
    expect(daysUntilInIsrael("2026-09-15T23:59:00Z", NOW)).toBe(1);
  });
});

describe("no hour of the day changes the answer", () => {
  /**
   * The midday anchoring is what guarantees this, and the reason it is worth
   * asserting rather than reasoning about: Israel's offset changes with DST,
   * and an anchor near midnight is the one that can land on the wrong side.
   */
  it("gives the same count at every hour of a day", () => {
    const counts = new Set<number>();
    for (let h = 0; h < 24; h++) {
      const at = new Date(Date.UTC(2026, 8, 14, h, 30));
      counts.add(daysUntilInIsrael("2026-09-20", at));
    }
    // Two distinct values at most: the Israeli day itself rolls over inside
    // this UTC window, which is correct and is the whole point.
    expect(counts.size).toBeLessThanOrEqual(2);
  });

  it("is stable across the spring DST change", () => {
    // Israel moves to DST in late March. Both operands are built from date
    // strings at a fixed UTC time, so no shift can enter.
    const before = new Date("2026-03-26T09:00:00Z");
    const after = new Date("2026-03-30T09:00:00Z");
    expect(daysUntilInIsrael("2026-04-15", before)).toBe(20);
    expect(daysUntilInIsrael("2026-04-15", after)).toBe(16);
  });
});

describe("both modules delegate rather than keeping a copy", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("compliance.ts calls the shared helper", () => {
    expect(read("src/lib/compliance.ts")).toContain("return daysUntilInIsrael(fromIso, today);");
  });

  it("reminders.ts calls the shared helper", () => {
    expect(read("src/lib/reminders.ts")).toContain("return daysUntilInIsrael(fromIso, to);");
  });

  it("neither keeps the arithmetic", () => {
    // The shape of the copy: the division by a day in milliseconds.
    for (const rel of ["src/lib/compliance.ts", "src/lib/reminders.ts"]) {
      expect(read(rel), rel).not.toContain("86_400_000");
    }
  });
});
