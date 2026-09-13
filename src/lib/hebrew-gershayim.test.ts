import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * מעמ and רוח are written with a gershayim, everywhere.
 *
 * THIS FILE EXISTS BECAUSE THE FIRST SWEEP WAS WRONG AND I REPORTED IT AS
 * DONE. I replaced 54 occurrences across 23 files and called the product
 * normalised. It was not: the search was for the literal three characters
 * `רו"ח`, and most occurrences live inside double-quoted strings as `רו\"ח` —
 * four characters, with a backslash between the vav and the quote. Those never
 * matched. 87 remained, more than the 54 fixed, including the line on the
 * public landing page that this smoke test finally surfaced.
 *
 * The sweep had no guard, which is exactly why the gap survived a claim that
 * it was complete. This is the guard, and it matches BOTH spellings, so
 * neither form can come back and neither can be missed again.
 *
 * ASCII quotes are not merely untidy here. `"` is not a Hebrew punctuation
 * mark; it is the typographic tell of machine-translated copy, in a product
 * whose whole proposition is that it was written by someone who knows Israeli
 * compliance. And it was five of the seven lint errors this session started
 * with, because React rightly objects to a bare quote in JSX text.
 */
const root = process.cwd();
const BACKSLASH = String.fromCharCode(92);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

/** Both spellings of the same mistake: bare, and escaped inside a string. */
const BAD = [
  'מע"מ',
  'רו"ח',
  "מע" + BACKSLASH + '"מ',
  "רו" + BACKSLASH + '"ח',
];

describe("the two abbreviations use the Hebrew gershayim", () => {
  it("no shipped or test file uses an ASCII quote in either", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      // This file necessarily contains every spelling it searches for. Fifth
      // guard this session to have matched its own definition.
      if (file.endsWith("hebrew-gershayim.test.ts")) continue;
      const src = readFileSync(file, "utf8");
      for (const bad of BAD) {
        if (src.includes(bad)) {
          offenders.push(`${file.slice(root.length + 1).split("\\").join("/")} :: ${bad}`);
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("and the gershayim form is actually present, so this is not vacuous", () => {
    // A sweep that deleted the abbreviations entirely would also pass the
    // assertion above.
    const all = walk(join(root, "src"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(all).toContain("מע\u05F4מ");
    expect(all).toContain("רו\u05F4ח");
  });

  it("catches the ESCAPED form specifically, which is the one that was missed", () => {
    // Guarding against my own mistake rather than the original one: the bare
    // form was easy to find and the escaped form is what survived.
    const escaped = "מע" + BACKSLASH + '"מ';
    expect(BAD).toContain(escaped);
    expect(escaped.length).toBe(5);
  });
});
