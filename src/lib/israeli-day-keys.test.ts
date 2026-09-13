import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { todayInIsrael } from "@/lib/dates";

/**
 * Anything that keys a decision on "today" must key it on the Israeli day.
 *
 * dates.ts exists because the app computed today as
 * `new Date().toISOString().slice(0, 10)` — UTC — and Israel is UTC+2/+3, so
 * between local midnight and 02:00/03:00 that returns YESTERDAY. Pure calendar
 * arithmetic (Date.UTC(y, m, d) back to an iso string) is explicitly fine and
 * stays; what is not fine is taking a MOMENT and slicing it as a date.
 *
 * Two survived that sweep, both outside the engines:
 *
 * The reminder digest's dedupe key. In that window the key resolved to
 * yesterday, alreadySent found yesterday's digest and skipped the send —
 * correct for the row it found, wrong for the day it was in. With the lazy
 * sweep as the trigger that can cost a whole day: if the only visit of a day
 * falls in that window, the key is the previous day, the send is deduped away,
 * and nobody gets a digest at all.
 *
 * The fallback issue date for an inbound document that arrives without one.
 * That date is bucketed by MONTH into revenue, and revenue is what the
 * עוסק פטור ceiling is computed from — so at a month boundary a document
 * ingested just after local midnight was counted in the wrong month.
 */
const root = process.cwd();

/** Only what ships counts: dates.ts QUOTES the old pattern in its docstring
 * to explain why it exists, and the sweep below flagged it for that alone. */
function stripComments(src: string): string {
  const withoutBlocks = src.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}


function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

/** `new Date()` — a moment — sliced as though it were a calendar date. */
const MOMENT_AS_DATE = /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/;

describe("no decision is keyed on the UTC day", () => {
  it("the reminder digest key uses the Israeli day", () => {
    const route = readFileSync(
      join(root, "src/app/api/cron/reminders/route.ts"),
      "utf8"
    );
    expect(route).toContain("digest:${todayInIsrael(today)}");
    expect(route).not.toContain("digest:${today.toISOString().slice(0, 10)}");
  });

  it("an inbound document with no date is dated the Israeli day", () => {
    const parse = readFileSync(join(root, "src/lib/integrations/parse.ts"), "utf8");
    expect(parse).not.toMatch(MOMENT_AS_DATE);
    // All three document kinds, not just the one that was noticed.
    expect(parse.split("todayInIsrael()").length - 1).toBeGreaterThanOrEqual(3);
  });

  it("nothing else slices a moment into a date", () => {
    /**
     * A coarse net over the shipped tree. Pure calendar construction is fine,
     * so this matches only the `new Date()` form — the one that takes the
     * current instant.
     *
     * Filenames are allowed: a stamp in an export's name is cosmetic, and a
     * user downloading at 00:30 local getting yesterday's date in the filename
     * costs nothing. Anything that DECIDES something must not be here.
     */
    const ALLOWED = new Set([
      "src/app/api/evidence/export/route.ts",
      "src/app/api/privacy/export/route.ts",
    ]);
    const offenders = walk(join(root, "src"))
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => MOMENT_AS_DATE.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(root.length + 1).split("\\").join("/"))
      .filter((rel) => !ALLOWED.has(rel));
    expect(offenders).toEqual([]);
  });

  it("the allowlist is not stale, so it cannot hide the next one", () => {
    // An exemption for a file that no longer has the pattern is one sitting
    // ready to excuse a real decision later.
    const stale = [
      "src/app/api/evidence/export/route.ts",
      "src/app/api/privacy/export/route.ts",
    ].filter((rel) => !MOMENT_AS_DATE.test(stripComments(readFileSync(join(root, rel), "utf8"))));
    expect(stale).toEqual([]);
  });
});

describe("todayInIsrael is what the key resolves to", () => {
  it("returns a yyyy-mm-dd", () => {
    expect(todayInIsrael()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("differs from the UTC slice exactly when Israel has rolled over", () => {
    // 22:30 UTC on 12 September is already 13 September in Israel. This is the
    // window the digest key was getting wrong.
    const instant = new Date("2026-09-12T22:30:00Z");
    expect(todayInIsrael(instant)).toBe("2026-09-13");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-09-12");
  });

  it("agrees with the UTC slice during the rest of the day", () => {
    const instant = new Date("2026-09-13T09:00:00Z");
    expect(todayInIsrael(instant)).toBe(instant.toISOString().slice(0, 10));
  });
});
