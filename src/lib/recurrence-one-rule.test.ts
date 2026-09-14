import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/lib/cycles";

/**
 * ONE ANSWER TO "WHEN IS THE NEXT CYCLE?".
 *
 * cycles.ts and reminders.ts each held a copy of the recurrence step, and
 * unlike the day count these two DID NOT AGREE. The fallback branch differed:
 *
 *   cycles.ts     else                        -> add a YEAR
 *   reminders.ts  else if (=== "yearly")      -> add NOTHING
 *
 * Recurrence is monthly | bimonthly | yearly | null, so the value they
 * disagreed about is null. One path invents an annual cycle for a task that
 * does not recur; the other returns the same date, and in reminders.ts that
 * sits inside rollForward's loop — which advances only while the date is past,
 * so with no advance it spins its full 240 iterations and hands back the stale
 * date it started from.
 *
 * Neither was reachable: both call sites guard with "template.recurrence &&".
 * That guard was convention, held separately in two modules, protecting the
 * highest-stakes arithmetic in the product — which recurring statutory filing
 * is due when. The parameter is NonNullable now, so the compiler holds it and
 * the branch they disagreed about does not exist.
 */
describe("each cadence advances by exactly its own step", () => {
  it("monthly", () => {
    expect(nextOccurrence("2026-01-15", "monthly")).toBe("2026-02-15");
  });

  it("bimonthly", () => {
    expect(nextOccurrence("2026-01-15", "bimonthly")).toBe("2026-03-15");
  });

  it("yearly", () => {
    expect(nextOccurrence("2026-01-15", "yearly")).toBe("2027-01-15");
  });
});

describe("month-end and leap years, where step arithmetic goes wrong", () => {
  it("rolls 31 January forward into March, as UTC month arithmetic does", () => {
    // Documented rather than corrected: this is the behaviour both copies had,
    // and both call sites feed it a completion date or a filing due date, none
    // of which the engine anchors to a month end.
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-03-03");
  });

  it("handles 29 February by landing on 1 March the next year", () => {
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-03-01");
  });

  it("crosses a year boundary from December", () => {
    expect(nextOccurrence("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(nextOccurrence("2026-11-15", "bimonthly")).toBe("2027-01-15");
  });
});

describe("it never consults the ambient timezone", () => {
  it("returns the same date whatever the host offset would imply", () => {
    // UTC in, UTC out: the operand is built at UTC midnight and read back with
    // getUTC*. A date-only string has no zone and must come back unshifted —
    // the failure that put revenue in the wrong month elsewhere today.
    expect(nextOccurrence("2026-03-01", "monthly")).toBe("2026-04-01");
    expect(nextOccurrence("2026-10-01", "monthly")).toBe("2026-11-01");
  });

  it("ignores a time component on the input", () => {
    expect(nextOccurrence("2026-01-15T23:30:00Z", "monthly")).toBe("2026-02-15");
  });
});

describe("neither module keeps a copy", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("reminders.ts calls the shared function", () => {
    expect(read("src/lib/reminders.ts")).toContain("nextOccurrence(next, recurrence)");
  });

  it("neither declares addRecurrence any more", () => {
    for (const rel of ["src/lib/cycles.ts", "src/lib/reminders.ts"]) {
      expect(read(rel), rel).not.toContain("function addRecurrence");
    }
  });

  it("reminders.ts no longer holds the UTC-day helper either", () => {
    // isoDay was d.toISOString().slice(0, 10) — the pattern the product
    // removed everywhere else — and nextOccurrence was its last caller.
    expect(read("src/lib/reminders.ts")).not.toContain("function isoDay");
  });
});
