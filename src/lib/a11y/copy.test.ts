import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hebrew copy register.
 *
 * The product addresses the user in the plural neutral (אתם / רשמו / תסמנו),
 * which is the register that avoids guessing anyone's gender. It had drifted in
 * a few places into second-person singular masculine — and in one card, into
 * both registers inside the same component: a title reading "עוד לא התחלת"
 * directly above a subtitle reading "ברגע שתסמנו". That reads as
 * machine-translated, and it is exactly the kind of thing that creeps back one
 * string at a time.
 *
 * These are narrow, deliberately. A broad morphological check on Hebrew would
 * produce false positives constantly; these are the specific forms that
 * actually appeared.
 */

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx$/.test(e.name) && !e.name.includes(".test.") ? [full] : [];
  });
}

/**
 * Forms that can ONLY be singular address, and are therefore safe to lint.
 *
 * The obvious candidates — התחלת, סימנת, הזנת, השלמת — are deliberately NOT
 * here, and finding out why was the useful part of writing this test. In Hebrew
 * the second-person-singular past tense and the construct-state noun are
 * spelled identically: "השלמת פרט" means "completing a detail" and
 * "להזנת פרטים" means "for the entering of details". Both are correct plural-
 * register copy, and both were flagged. A test that fails on correct Hebrew
 * gets disabled rather than obeyed, so the ambiguous forms are out.
 *
 * What remains are pronouns and possessives, which have no noun reading:
 *   אתה   you (m. sg.)
 *   שלך   your (sg.)
 *   תוכל  you will be able (m. sg.) — no construct form exists
 *
 * First-person forms (התחלתי, "I haven't started") are also absent on purpose:
 * those are the user describing their own state in an option label, which is
 * correct.
 */
const SINGULAR_ADDRESS = ["אתה ", "שלך ", "שלך.", "שלך,", "תוכל "];

describe("Hebrew copy stays in one register", () => {
  it("never addresses the reader as a single man", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, "utf8");
      for (const form of SINGULAR_ADDRESS) {
        if (!src.includes(form)) continue;
        // Report the line so a real offender is easy to find, and so a false
        // positive is easy to judge.
        src.split("\n").forEach((line, i) => {
          if (line.includes(form)) {
            offenders.push(
              `${path.relative(process.cwd(), file)}:${i + 1} "${form.trim()}"`
            );
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("spells ניצחונות with the yod", () => {
    // Was נצחונות. A misspelling in a heading is the cheapest possible way to
    // look unfinished.
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, "utf8");
      expect(src, path.relative(process.cwd(), file)).not.toContain("נצחונות");
    }
  });
});

describe("no emoji or text glyphs standing in for icons", () => {
  /**
   * Pictographic emoji only. Not a blanket non-ASCII ban — the entire product
   * is in Hebrew, and the ₪ sign, the bullet, the en dash and the •••• mask are
   * all legitimate typography.
   *
   * The eight that were here read as unfinished in a product a business owner
   * trusts with their tax files, and two of them were worse than decorative:
   * "✓ נשמר" was a text glyph doing an icon's job with nothing announced to a
   * screen reader, and icon: "🔓" was an emoji passed into a slot that expects
   * a node.
   */
  const PICTOGRAPHIC =
    /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

  /** A line that is only a comment. This file's own prose names the glyphs. */
  const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

  it("no pictographic emoji in any component", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (isComment(line)) return;
        const match = line.match(PICTOGRAPHIC);
        if (match) {
          offenders.push(
            `${path.relative(process.cwd(), file)}:${i + 1} "${match[0]}"`
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("no mailto: to a personal inbox in shipped UI", () => {
    // A personal Gmail address was the CTA on the partner card — a second
    // funnel competing with /partners, which now has rate limiting, length
    // caps and a honeypot.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, "utf8");
      if (/mailto:[^"'`\s]*@(gmail|hotmail|outlook|yahoo)\./i.test(src)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
