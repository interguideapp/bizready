import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The "הדדליין הבא" tile said something about itself that was not true.
 *
 * Its detail line read "חובות סטטוטוריים בלבד נספרים כאן" — only statutory
 * obligations are counted here — while the value is `actionable[0]`, the
 * earliest of ALL obligations, renewals and document expiries included. A user
 * whose nearest item was a lapsing insurance policy saw the policy's own name
 * beside a sentence saying policies are not counted.
 *
 * Narrowing the tile to statutory would have been the worse fix: it would hide
 * a policy lapsing in three days behind a filing forty days out, on the tile
 * whose whole job is "what is closest". So the tile names which kind it is
 * showing, and each kind gets the consequence that is actually its own —
 * overclaiming legal consequence is the one thing this product must not do, and
 * no authority charges interest on an expired professional-liability policy.
 *
 * Asserted at the source because home-os.tsx takes one large data object and
 * rendering it in a test would assert the fixture, not the page.
 */
const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const tile = read("src/components/home/home-os.tsx");
const page = read("src/app/(app)/home/page.tsx");

describe("the tile no longer claims to count only statutory obligations", () => {
  it("drops the false sentence", () => {
    expect(tile).not.toContain("חובות סטטוטוריים בלבד נספרים כאן");
  });

  it("names the kind it is actually showing", () => {
    expect(tile).toContain('data.nextDeadline.basis === "statutory"');
  });

  it("gives each kind the consequence that is its own", () => {
    // A missed filing carries a penalty. A lapsed policy carries no penalty and
    // no cover, and saying otherwise would overclaim legal consequence.
    expect(tile).toMatch(/חובה סטטוטורית/);
    expect(tile).toMatch(/אין כיסוי/);
    expect(tile).not.toMatch(/חידוש או תפוגה — לאיחור יש קנס/);
  });

  it("is fed the basis by the page", () => {
    // The copy can only be right if the field reaches it.
    expect(page).toContain("basis: actionable[0].basis");
  });

  it("still shows the earliest obligation of any kind", () => {
    // The regression to guard against is "fix the sentence by narrowing the
    // data", which would hide an imminent renewal.
    expect(page).toContain("actionable[0].title");
    expect(page).not.toMatch(/actionable\s*\.filter\([^)]*statutory/);
  });
});

describe("the tile value keeps the Hebrew dual", () => {
  it("says יומיים rather than 2 ימים", () => {
    expect(tile).toContain('if (d === 2) return "יומיים";');
  });
});
