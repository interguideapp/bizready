import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatHeDate,
  formatHeMoment,
  formatHeMomentDayMonth,
  formatHeMomentWithTime,
} from "@/lib/dates";

/**
 * THE HALF THE DEADLINE SWEEP DID NOT COVER.
 *
 * "Pin displayed deadline dates to Israel" fixed the dates. It did not touch
 * the TIMESTAMPS, and sixteen sites rendered those as
 * `new Date(iso).toLocaleDateString("he-IL")` — an instant formatted in
 * whatever zone the renderer happens to be in. On a Vercel server that is UTC.
 *
 * Israel is UTC+2/+3, so for the two to three hours each evening after Israeli
 * midnight, every one of those showed the PREVIOUS day. Where: completed_at on
 * /tracking, task_events on the activity trail, filedAt in the filing history,
 * created_at on documents, and the evidence pack's own generation date. The
 * surfaces whose entire job is answering "when did this happen".
 *
 * For a filing due on the 15th, "filed on the 15th" and "filed on the 14th"
 * is the difference between on time and late — recorded, exported, and shown
 * to whoever asks.
 *
 * And formatHeDate could not be reused: it slices the first ten characters,
 * which for a timestamptz is the UTC calendar day. Same wrong answer by a
 * different route.
 */

/** 22:30 UTC on the 14th is 01:30 on the 15th in Israel. */
const EVENING = "2026-09-14T22:30:00Z";
/** 08:00 UTC is mid-morning in Israel the same day — the easy case. */
const MORNING = "2026-09-14T08:00:00Z";

describe("an instant is reported as the Israeli day it happened on", () => {
  it("reads the evening after Israeli midnight as the NEXT day", () => {
    // The whole bug, in one assertion.
    expect(formatHeMoment(EVENING)).toBe("15.9.2026");
  });

  it("still reads a daytime instant as that day", () => {
    expect(formatHeMoment(MORNING)).toBe("14.9.2026");
  });

  it("does not agree with slicing the timestamp, which is the UTC day", () => {
    // formatHeDate is right for date-only strings and wrong for these, so the
    // two must be visibly different here or the fix means nothing.
    expect(formatHeDate(EVENING)).toBe("14.9.2026");
    expect(formatHeMoment(EVENING)).not.toBe(formatHeDate(EVENING));
  });

  it("carries the clock time in Israel when the hour is shown", () => {
    // Used on the sync-error log, where the hour is the point.
    const text = formatHeMomentWithTime(EVENING);
    expect(text).toContain("15.9.2026");
    expect(text).toMatch(/01:30/);
  });

  it("has a day-month form that agrees with the full one", () => {
    expect(formatHeMomentDayMonth(EVENING)).toBe("15.9");
  });
});

describe("it never renders garbage", () => {
  it("returns an unparseable value untouched rather than Invalid Date", () => {
    expect(formatHeMoment("not a date")).toBe("not a date");
    expect(formatHeMomentWithTime("nope")).toBe("nope");
  });

  it("treats a missing timestamp as empty, not as the epoch", () => {
    // A null completed_at rendering as 1.1.1970 on the activity trail is the
    // kind of thing that makes a whole screen untrustworthy.
    expect(formatHeMoment(null)).toBe("");
    expect(formatHeMoment(undefined)).toBe("");
    expect(formatHeMomentDayMonth(null)).toBe("");
  });
});

describe("no surface formats an instant in the ambient zone", () => {
  /**
   * The guard. A new screen showing a created_at is the regression, and it is
   * invisible except for a couple of hours each evening — which is precisely
   * why it survived the deadline sweep.
   *
   * A date-only string parsed with an explicit "T00:00:00" and formatted in
   * the same ambient zone round-trips correctly, so those are not flagged; the
   * flagged shape is an INSTANT handed to a locale formatter.
   */
  const ALLOWED = new Set([
    // The header clock. Deliberately the viewer's own wall time: a person in
    // another country wants to see their clock, not Israel's, and it shows a
    // time rather than a deadline.
    "src/components/home/home-os.tsx",
    // The helpers themselves.
    "src/lib/dates.ts",
  ]);

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
    });
  }

  const root = process.cwd();
  const rel = (f: string) => f.slice(root.length + 1).split("\\").join("/");

  /** `new Date(<expr>).toLocaleDate…` where <expr> is not a date-only literal. */
  const INSTANT_FORMAT = /new Date\(([^)]*)\)\s*\.\s*toLocale(?:Date|Time)?String/g;

  it("the premise: the pattern still matches the shape it describes", () => {
    // Without this the regex could have rotted and the sweep below would be
    // reporting an all-clear it never checked for.
    const sample = 'new Date(row.created_at).toLocaleDateString("he-IL")';
    expect([...sample.matchAll(INSTANT_FORMAT)]).toHaveLength(1);
  });

  it("flags nothing in the current tree", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      const path = rel(file);
      if (ALLOWED.has(path)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(INSTANT_FORMAT)) {
        // A date-only string made explicit is safe: parsed and formatted in
        // one zone, so the rendered day equals the day in the string.
        if (m[1].includes('"T00:00:00"') || m[1].includes("T00:00:00")) continue;
        offenders.push(`${path}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
