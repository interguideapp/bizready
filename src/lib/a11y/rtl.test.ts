import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RTL by design rather than by accident.
 *
 * The app had ~55 physical-direction utilities (`pr-`, `mr-`, `right-[13px]`,
 * `text-left`) and effectively zero logical properties, which Tailwind v4
 * ships. Every one of those was correct only because the document happens to be
 * RTL — and the app already renders LTR deliberately, per field, for file
 * numbers and bank accounts, so "it happens to be RTL" is not a safe assumption
 * even inside this product.
 *
 * This test keeps the physical ones from coming back.
 */

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx$/.test(e.name) && !e.name.includes(".test.") ? [full] : [];
  });
}

/** Only the contents of className attributes — prose and comments are fine. */
function classNamesIn(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    out.push(m[1] ?? m[2] ?? "");
  }
  return out;
}

const PHYSICAL: [RegExp, string][] = [
  [/\bp[lr]-(?:\[[^\]]+\]|auto|[\d.]+)\b/, "use ps-/pe-"],
  [/\bm[lr]-(?:\[[^\]]+\]|auto|[\d.]+)\b/, "use ms-/me-"],
  [/\b(?:left|right)-(?:\[[^\]]+\]|auto|[\d.]+)\b/, "use start-/end-"],
  [/\btext-(?:left|right)\b/, "use text-start/text-end"],
  [/\bborder-[lr]-/, "use border-s-/border-e-"],
  [/\brounded-[tb]?[lr]-/, "use rounded-s-/rounded-e- (or the -ss/-se corners)"],
];

describe("layout uses logical directions, not physical ones", () => {
  it("no className contains a physical-direction utility", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file);
      const src = fs.readFileSync(file, "utf8");
      for (const cls of classNamesIn(src)) {
        for (const [re, hint] of PHYSICAL) {
          const m = cls.match(re);
          if (m) offenders.push(`${rel}: "${m[0]}" — ${hint}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("dir=\"ltr\" is never applied to a whole region", () => {
    // The passport view forced dir="ltr" on every identity value, including the
    // Hebrew bank name and the accountant's name, which mis-orders them. LTR is
    // a per-field decision about the CONTENT (a file number, an email), never a
    // property of a container.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file);
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/<(section|main|div|ul|ol|dl|table|form)\b[^>]*dir="ltr"/g)) {
        offenders.push(`${rel}: <${m[1]} dir="ltr">`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
