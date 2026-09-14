import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_FORMS, countLabel, durationLabel } from "@/lib/he-distance";

/**
 * A NUMERAL 1 BESIDE A HEBREW PLURAL IS WRONG, AND THIS IS THE SEVENTH TIME.
 *
 * Hebrew has a dual: two days is "יומיים", not "2 ימים". And "1 משימות" reads
 * like a machine wrote it. Six noun pairs were fixed one at a time inside
 * he-distance.ts, each with its own assertion — and durationLabel, which has
 * handled exactly this since it was written, was called by nothing outside its
 * own module.
 *
 * Meanwhile the home screen's streak tile rendered "1 ימים" and "1 ימים ברצף"
 * — the most-read surface in the product — and /plan-ready told a business
 * with one task in one category "1 משימות ב-1 תחומים", in the first sentence
 * it ever shows them.
 *
 * Found by sweeping for a number interpolated straight in front of a plural
 * noun. Fixing the sites one more time would have left the eighth just as
 * likely, so the sweep is the guard.
 */
const root = process.cwd();

describe("the count helper produces forms Hebrew uses", () => {
  it("one is spelled out, never a numeral beside a plural", () => {
    expect(countLabel(1, TASK_FORMS)).toBe("משימה אחת");
    expect(countLabel(1, TASK_FORMS)).not.toContain("1");
  });

  it("two is the dual", () => {
    expect(countLabel(2, TASK_FORMS)).toBe("שתי משימות");
    expect(countLabel(2, TASK_FORMS)).not.toContain("2");
  });

  it("three and up take the numeral", () => {
    expect(countLabel(3, TASK_FORMS)).toBe("3 משימות");
    expect(countLabel(40, TASK_FORMS)).toBe("40 משימות");
  });

  it("zero reads as a plural, which is correct in Hebrew", () => {
    expect(countLabel(0, TASK_FORMS)).toBe("0 משימות");
  });

  it("durationLabel already did this for time, and still does", () => {
    expect(durationLabel(1)).toBe("יום");
    expect(durationLabel(2)).toBe("יומיים");
    expect(durationLabel(5)).toBe("5 ימים");
  });

  it("no form pairs a numeral 1 or 2 with a plural, at any count", () => {
    for (let n = 0; n <= 400; n++) {
      const label = countLabel(n, TASK_FORMS);
      expect(label, String(n)).not.toMatch(/(?:^|\s)1 משימות/);
      expect(label, String(n)).not.toMatch(/(?:^|\s)2 משימות/);
    }
  });
});

describe("no surface interpolates a number straight before a plural", () => {
  /**
   * The sweep, so the eighth instance fails the build instead of shipping.
   *
   * Exempted: a FRACTION ("1/3 משימות") is correct Hebrew — the plural attaches
   * to the ratio, not to the numeral — and "more than N" with a constant N
   * that is never 1 or 2 reads fine.
   */
  const PLURALS = [
    "ימים",
    "שבועות",
    "חודשים",
    "שנים",
    "שעות",
    "דקות",
    "פריטים",
    "משימות",
    "התראות",
    "רשומות",
    "מסמכים",
    "עסקים",
    "דפדפנים",
    "תקופות",
    "הגשות",
    "שגיאות",
    "טענות",
    "תחומים",
  ];

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
    });
  }

  /** `{expr}` or `${expr}` immediately before one of the plural nouns. */
  function offendingLines(text: string): string[] {
    const out: string[] = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("*") || t.startsWith("//")) continue;
      // A ratio is fine: {a}/{b} noun.
      if (/\}\s*\/\s*\{/.test(line)) continue;
      for (const noun of PLURALS) {
        const tpl = new RegExp("\$\{[^}]{1,60}\}[ -]{0,3}" + noun);
        const jsx = new RegExp("[^$]\{[^}{]{1,60}\}[ -]{0,3}" + noun);
        if (tpl.test(line) || jsx.test(line)) {
          out.push(t.slice(0, 120));
          break;
        }
      }
    }
    return out;
  }

  const ALLOWED = new Map<string, string>([
    [
      "src/app/(app)/notifications/page.tsx",
      "‘more than N’ where N is NOTIFICATIONS_PAGE_SIZE, a constant that is " +
        "never 1 or 2",
    ],
  ]);

  it("the premise: the detector matches the shape that shipped", () => {
    expect(offendingLines("<>{streak} ימים ברצף</>")).not.toEqual([]);
    expect(offendingLines("{c.done}/{c.total} משימות")).toEqual([]);
    expect(offendingLines("{countLabel(n, TASK_FORMS)}")).toEqual([]);
  });

  it("finds none outside the named exemption", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      const rel = file.slice(root.length + 1).split("\\").join("/");
      if (ALLOWED.has(rel)) continue;
      for (const line of offendingLines(readFileSync(file, "utf8"))) {
        offenders.push(rel + ": " + line);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the exemption is not stale", () => {
    const stale = [...ALLOWED.keys()].filter(
      (rel) => offendingLines(readFileSync(join(root, rel), "utf8")).length === 0
    );
    expect(stale).toEqual([]);
  });
});
