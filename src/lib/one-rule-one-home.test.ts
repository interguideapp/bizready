import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * INVARIANT: A RULE IS DECLARED ONCE.
 *
 * Not a style preference. Every one of these was a real defect or one edit
 * from being one, and all of them were found by listing names declared in more
 * than one module:
 *
 *   STATUTORY_FILINGS   declared twice, flagged by the audit as a correctness
 *                       risk before it drifted
 *   ConfidenceState     declared twice
 *   scoreCreditFor      exported, documented and TESTED in task-status.ts
 *                       while computeScore inlined a copy that disagreed with
 *                       it about "waiting" — the tested value was not the
 *                       rendered value, on the readiness score
 *   addRecurrence       two copies that disagreed about a null recurrence:
 *                       one invented an annual cycle, the other returned the
 *                       same date and left rollForward's loop unable to advance
 *   FilingPeriod        two shapes under one name, AND two implementations of
 *                       the VAT deadline — the board read one, the ledger the
 *                       other
 *   daysBetween         two byte-identical copies of "is this late?", in the
 *                       two modules that must never disagree about it
 *   formatIls           two exported formatters producing "₪4,210" and
 *                       "4,210 ₪" — the same sum read two ways on two screens
 *   isoDay              two copies of the UTC-day pattern the product had
 *                       otherwise removed
 *
 * Seven of those eight were invisible: every test passed, the build was clean,
 * and the screens looked right. So the sweep is mechanical, and a NEW
 * duplicate has to be justified here.
 */
const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
  });
}

const rel = (f: string) => f.slice(root.length + 1).split("\\").join("/");

/**
 * Top-level declarations per name.
 *
 * Top level only: a name declared inside two different function bodies is two
 * locals and carries no risk of a reader picking the wrong one.
 */
function declarationsByName(): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const file of walk(join(root, "src"))) {
    const src = readFileSync(file, "utf8");
    for (const line of src.split("\n")) {
      const m = line.match(
        /^(?:export )?(?:const|let|function|async function|type|interface|enum|class) ([A-Za-z_$][A-Za-z0-9_$]*)/
      );
      if (!m) continue;
      const list = byName.get(m[1]) ?? [];
      list.push(rel(file));
      byName.set(m[1], list);
    }
  }
  return byName;
}

/**
 * Names allowed in more than one module, each with the reason.
 *
 * The bar: it must be a LOCAL VIEW CONCERN or a framework requirement, never a
 * rule about dates, status, money, counts or promises. If a reader could pick
 * the wrong one and get a different answer, it does not belong here.
 */
const ALLOWED = new Map<string, string>([
  // Next.js route and page contracts — one per file by design.
  ["GET", "route handler export"],
  ["POST", "route handler export"],
  ["dynamic", "Next.js route segment config"],
  ["maxDuration", "Next.js route segment config"],
  ["metadata", "Next.js page metadata"],
  // Presentation-only aliases and local render helpers. Each wraps a shared
  // function or is pure markup; none decides a value.
  ["nis", "local alias for the shared formatIlsRounded"],
  ["heDate", "local alias for a shared date formatter"],
  ["ICONS", "per-screen icon map, pure presentation"],
  ["Ic", "per-screen icon alias"],
  ["Row", "per-screen row component"],
  ["field", "per-form input class string"],
  ["REVIEWED", "per-content-file review date stamp"],
  ["HE_MONTHS", "identical month-name list; a wrong entry is visible instantly"],
  ["STAGE_OF", "per-page Map built from the shared CATEGORIES"],
  ["BASE", "per-provider API base URL"],
  ["createClient", "the browser and server Supabase clients are different things"],
  ["requireBusiness", "one is data.ts's loader, one a module-local auth helper"],
  ["Stage", "two unrelated stage vocabularies: journey stage and milestone stage"],
  ["ConnectionRow", "a DB row type and a component prop type"],
  ["escapeHtml", "HTML escaping for a generated document and for an email body"],
  ["agoPhrase", "two different phrasings for two different surfaces"],
  ["monthKey", "different inputs: an absolute month index and a (year, month) pair"],
  ["addDays", "same contract in both, both day-in day-out; see plan-one-today"],
  [
    "daysBetween",
    "both are one-line delegations to daysUntilInIsrael; asserted in days-until-one-rule",
  ],
]);

describe("no rule is declared in two modules", () => {
  it("the premise: the scanner finds the declarations it is looking for", () => {
    const byName = declarationsByName();
    // Names that certainly exist, so a rotted pattern cannot read as clean.
    expect(byName.get("computeUpcomingObligations")?.length).toBe(1);
    expect(byName.get("daysUntilInIsrael")?.length).toBe(1);
    expect((byName.get("GET") ?? []).length).toBeGreaterThan(1);
  });

  it("flags nothing outside the named exemptions", () => {
    const offenders: string[] = [];
    for (const [name, files] of declarationsByName()) {
      const distinct = [...new Set(files)];
      if (distinct.length < 2) continue;
      if (ALLOWED.has(name)) continue;
      offenders.push(`${name}: ${distinct.join("  |  ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every exemption is still a duplicate, so the list cannot hide the next one", () => {
    const byName = declarationsByName();
    const stale = [...ALLOWED.keys()].filter(
      (name) => [...new Set(byName.get(name) ?? [])].length < 2
    );
    expect(stale).toEqual([]);
  });

  it("the consolidated names are gone from the codebase as duplicates", () => {
    // The eight from the docstring. Each should now resolve to one module, or
    // to an exemption that explains why two is correct.
    const byName = declarationsByName();
    for (const name of [
      "scoreCreditFor",
      "addRecurrence",
      "FilingPeriod",
      "isoDay",
      "formatIls",
      "STATUTORY_FILINGS",
      "ConfidenceState",
    ]) {
      expect([...new Set(byName.get(name) ?? [])].length, name).toBeLessThan(2);
    }
  });
});
