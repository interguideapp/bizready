import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * INVARIANT: ONE "TODAY", AND IT IS ISRAEL'S.
 *
 * The product's entire value is deadline accuracy, and Israel is UTC+2/+3 — so
 * for two to three hours every night the UTC calendar day is yesterday's, and
 * for those hours on 1 January the UTC year is last year's. lib/dates exists to
 * be the only place that resolves a calendar day or year from an instant.
 *
 * It kept not being the only place. Found and fixed in one session, all of the
 * same shape and none visible in a screenshot:
 *
 *   integrations/apply.ts  stamped the UTC day onto synced revenue, and summed
 *                          the ceiling over the UTC year — so revenue landed
 *                          in the previous month and the first sync after
 *                          Israeli new year reused the old year's dedupe key
 *   insights/page.tsx      filtered revenueYtd by the UTC year, so just after
 *                          Israeli new year the ceiling percentage measured
 *                          LAST year's whole turnover against this year's
 *                          ceiling — a crossing that has not happened
 *   home/page.tsx          read the metrics window from the same clock
 *   rules-engine.ts        dated recommended tasks from the UTC day while the
 *                          statutory branch of the same expression used
 *                          Israel's — two "todays" in one function
 *   finance/income.ts      offered the manual-income months from the HOST
 *                          clock, so after Israeli midnight on the 1st the
 *                          newest row was last month and a person typing
 *                          "this month's income" filed it into the wrong one
 *
 * Five instances of one root cause is not a run of bad luck, it is a missing
 * guard. This is the guard.
 */
const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
  });
}

function shipped(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const rel = (f: string) => f.slice(root.length + 1).split("\\").join("/");

/**
 * Reading a calendar field off the HOST clock.
 *
 * getMonth/getFullYear/getDate/getDay with no UTC in the name resolve in
 * whatever zone the process or browser is in — never Israel's, except by
 * coincidence. There is no legitimate use in this product: a calendar question
 * goes through lib/dates, and a duration is computed from getTime().
 */
const HOST_CLOCK = /\.get(?:Month|FullYear|Date|Day)\s*\(/;

describe("no production code reads a calendar field off the host clock", () => {
  /**
   * Each entry states why it is not a compliance date. An unnamed exemption is
   * the next hidden bug, so the list is specific and short.
   */
  const ALLOWED = new Map<string, string>([
    [
      "src/components/kits/ceiling-meter.tsx",
      "a client-side slider's initial value — the viewer's own month, adjustable, " +
        "and not a date the product asserts",
    ],
    [
      "src/lib/integrations/greeninvoice.ts",
      "the default start of a provider fetch window; a year early only fetches more",
    ],
    [
      "src/lib/integrations/icount.ts",
      "same: the default start of a provider fetch window",
    ],
  ]);

  it("the premise: the pattern matches a host-clock read", () => {
    // A rotted regex would report an all-clear it never checked for.
    expect(HOST_CLOCK.test("const y = now.getFullYear();")).toBe(true);
    expect(HOST_CLOCK.test("d.getUTCFullYear()")).toBe(false);
    expect(HOST_CLOCK.test("israelParts(now).year")).toBe(false);
  });

  it("flags none outside the named exemptions", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      const path = rel(file);
      if (ALLOWED.has(path)) continue;
      if (path === "src/lib/dates.ts") continue;
      for (const line of shipped(file).split("\n")) {
        if (HOST_CLOCK.test(line)) offenders.push(path + ": " + line.trim());
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every exemption still contains what it exempts", () => {
    // An exemption for a file that no longer has the pattern is an exemption
    // sitting ready to hide the next one.
    const stale = [...ALLOWED.keys()].filter(
      (path) => !HOST_CLOCK.test(shipped(join(root, path)))
    );
    expect(stale).toEqual([]);
  });
});

describe("lib/dates is the only module that turns an instant into a day", () => {
  /**
   * toISOString().slice(0, 10) is the UTC day. It is CORRECT when the Date was
   * built from a date-only string or Date.UTC parts — UTC in, UTC out, and
   * several helpers do exactly that on purpose. It is wrong on an instant.
   *
   * A static scan cannot always tell which it is, so this pins the sites that
   * exist and why, rather than pretending to classify them. The value is that
   * a NEW one has to be justified here.
   */
  const KNOWN = new Set([
    // UTC in, UTC out: the operand is built from a date string or Date.UTC.
    "src/lib/compliance.ts",
    "src/lib/cycles.ts",
    "src/lib/deadline-options.ts",
    "src/lib/rules-engine.ts",
    "src/lib/content/milestones.ts",
    "src/lib/integrations/parse.ts",
    // Filename stamps on an export, not a compliance date.
    "src/app/api/evidence/export/route.ts",
    "src/app/api/privacy/export/route.ts",
    "src/lib/privacy.ts",
  ]);

  it("no unlisted module derives a day from toISOString", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      const path = rel(file);
      if (path === "src/lib/dates.ts" || KNOWN.has(path)) continue;
      if (/toISOString\(\)\.(?:slice|substring)\(0, ?10\)/.test(shipped(file))) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the list is not stale", () => {
    const stale = [...KNOWN].filter(
      (path) => !/toISOString\(\)\.(?:slice|substring)\(0, ?10\)/.test(shipped(join(root, path)))
    );
    expect(stale).toEqual([]);
  });
});
