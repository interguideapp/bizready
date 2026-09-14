import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERIOD_KEY_SHAPE } from "@/lib/filings";
import { ISO_DATE_SHAPE } from "@/lib/dates";

/**
 * A LOST BACKSLASH LEVEL, SHIPPED TWICE, IN CODE THAT STILL COMPILES.
 *
 * markPeriodFiled validated a ledger period key with a literal reading
 * "caret d brace 4 brace dash d brace 2 brace dot dot ..." — literal "d"
 * characters, not digit classes. It matched "dddd-dd..dddd-dd" and rejected
 * "2026-07..2026-08", so every real key failed validation and the action threw
 * "invalid period" on every single call.
 *
 * What that switched off is the point. The obligations board offers "mark this
 * period filed" precisely because a named missed period has to be clearable —
 * its own comment says an alarm with no off switch is worse than not raising
 * it. The off switch had never worked once.
 *
 * The same defect shipped once before in a date pattern. It happens for a
 * mechanical reason: writing a file through a shell or a node string eats one
 * backslash level silently, and the result is still a valid regex. Nothing
 * fails, nothing logs, and it reads correctly at a glance.
 *
 * Read at a glance is exactly how it survived, so it is checked mechanically.
 *
 * THIS FILE CONTAINS NO LITERAL BACKSLASH, deliberately — the first draft of
 * it was itself mangled on the way to disk, which is the whole argument. Where
 * one is needed it is built from its character code, and the scanner below is
 * hand-written rather than a regex so it cannot be mangled either.
 */
const BS = String.fromCharCode(92);
const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

/**
 * Find a quantifier applied to a bare class letter: `d{4}` where `\d{4}` was
 * meant. Nobody quantifies the literal letter d, s, w or b.
 *
 * Character-level on purpose. Extracting regex literals with a regex is how
 * the first version of this file broke, and a scanner that needs no escapes
 * cannot lose one.
 */
export function mangledClassQuantifiers(text: string): string[] {
  const CLASS_LETTERS = "dswb";
  const found: string[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (!CLASS_LETTERS.includes(text[i])) continue;
    if (text[i + 1] !== "{") continue;
    // A digit must follow the brace, or it is not a quantifier.
    if (!/[0-9]/.test(text[i + 2] ?? "")) continue;
    const before = text[i - 1] ?? "";
    // Correctly escaped, or inside a character class, or part of a word.
    if (before === BS) continue;
    if (before === "[") continue;
    if (/[A-Za-z0-9_$]/.test(before)) continue;
    found.push(text.slice(Math.max(0, i - 6), i + 6));
  }
  return found;
}

describe("the detector fires on what shipped and not on what is correct", () => {
  it("flags the mangled form", () => {
    // Built, not typed: the mangled form is what a literal here would become.
    expect(mangledClassQuantifiers("/^d{4}-d{2}$/")).not.toEqual([]);
  });

  it("does not flag the escaped form", () => {
    expect(mangledClassQuantifiers("/^" + BS + "d{4}-" + BS + "d{2}$/")).toEqual([]);
  });

  it("does not flag a character class", () => {
    expect(mangledClassQuantifiers("/^[0-9]{4}$/")).toEqual([]);
  });

  it("does not flag an identifier that happens to end in one of the letters", () => {
    // "id{" in an object type, "words{" in a template — not regexes.
    expect(mangledClassQuantifiers("type Id{4}")).toEqual([]);
  });
});

describe("the codebase has none", () => {
  it("finds nothing under src", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      // This file names the shape in prose; anything it flags in itself is
      // the documentation, not shipped code.
      if (file.endsWith("eaten-escapes.test.ts")) continue;
      const hits = mangledClassQuantifiers(readFileSync(file, "utf8"));
      if (hits.length > 0) {
        offenders.push(file.slice(root.length + 1).split("\\").join("/") + ": " + hits.join(" | "));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the period key shape accepts the keys the product produces", () => {
  /**
   * The other half of the lesson: a regex can be syntactically valid and still
   * reject everything real. That literal did, and no test ever fed it an
   * actual key — the entire defect would have been caught by one assertion.
   */
  const shape = new RegExp("^" + PERIOD_KEY_SHAPE + "$");

  it("accepts a bimonthly period", () => {
    expect(shape.test("2026-07..2026-08")).toBe(true);
  });

  it("accepts a monthly period, where both halves are the same month", () => {
    expect(shape.test("2026-09..2026-09")).toBe(true);
  });

  it("accepts a period spanning a year boundary", () => {
    expect(shape.test("2026-11..2027-01")).toBe(true);
  });

  it("rejects what the mangled version accepted", () => {
    expect(shape.test("dddd-dd..dddd-dd")).toBe(false);
  });

  it("still rejects malformed input, since this guards a public endpoint", () => {
    for (const bad of [
      "2026-7..2026-8",
      "2026-07-2026-08",
      "2026-07..2026",
      "",
      "'; drop table task_filings; --",
      "2026-07..2026-08 ",
    ]) {
      expect(shape.test(bad), bad).toBe(false);
    }
  });

  it("contains no backslash at all, so nothing can eat one", () => {
    // The structural fix: character classes instead of escapes.
    expect(PERIOD_KEY_SHAPE.includes(BS)).toBe(false);
  });
});

describe("the personal-deadline shape accepts a real date", () => {
  /**
   * THE SECOND DEAD VALIDATOR, found by the sweep above rather than by reading.
   *
   * setTaskDueDate used the same mangled shape for a date-only string, so it
   * threw "invalid date" for "2026-09-15" and for every other date a user
   * could pick. The personal-deadline feature (migration 028) could therefore
   * never store a date — measured on the live database: 87 tasks, ZERO with a
   * personal_due_date, ZERO with a follow_up_date.
   *
   * And the product PROMISES to remind you about a personal target: the
   * deadline picker is on the allowlist in a11y/promises.test.ts on the
   * grounds that "personal_due_date is in the engine". The engine was ready;
   * nothing could ever put a value in front of it.
   */
  const shape = new RegExp("^" + ISO_DATE_SHAPE + "$");

  it("accepts an ordinary date", () => {
    expect(shape.test("2026-09-15")).toBe(true);
  });

  it("accepts the first and last day of a year", () => {
    expect(shape.test("2027-01-01")).toBe(true);
    expect(shape.test("2026-12-31")).toBe(true);
  });

  it("rejects what the mangled version accepted", () => {
    expect(shape.test("dddd-dd-dd")).toBe(false);
  });

  it("rejects malformed input, since this guards a public endpoint", () => {
    for (const bad of ["2026-9-15", "2026/09/15", "15-09-2026", "", "2026-09-15T00:00:00Z"]) {
      expect(shape.test(bad), bad).toBe(false);
    }
  });

  it("contains no backslash, so nothing can eat one", () => {
    expect(ISO_DATE_SHAPE.includes(BS)).toBe(false);
  });
});

/**
 * A SECOND SIGNATURE THE FIRST SWEEP DID NOT SEE.
 *
 * The detector above looks for a quantifier applied to a bare class letter —
 * `d{4}` where a digit class was meant. It found two dead validators and
 * missed a third defect of the same origin, because that one lost its
 * backslash INSIDE a character class:
 *
 *     [^s@]   where   [^ (backslash) s @ ]   was meant
 *
 * Which reads "not the letter s, not at-sign". The public partner-application
 * form used it, so every address containing an s — moshe@business.co.il,
 * yossi@post.co.il — was told "כתובת האימייל לא נראית תקינה". A valid address
 * refused, with a message blaming the applicant.
 *
 * A bare letter inside a class is usually legitimate (`[abc]`), so the check
 * is narrowed to the shape that is almost never intentional: a NEGATED class
 * containing one of the class letters together with punctuation. Nobody writes
 * "any character except the letter s and the at-sign".
 */
export function mangledNegatedClasses(text: string): string[] {
  const found: string[] = [];
  const CLASS_LETTERS = "dswSWD";
  for (let i = 0; i + 2 < text.length; i++) {
    if (text[i] !== "[" || text[i + 1] !== "^") continue;
    const close = text.indexOf("]", i + 2);
    if (close < 0) continue;
    const body = text.slice(i + 2, close);
    // An escaped letter is the correct form and is written with a backslash,
    // so a body that contains one is fine by construction.
    if (body.includes(BS)) continue;
    const hasClassLetter = [...body].some((c) => CLASS_LETTERS.includes(c));
    const hasPunctuation = /[@.:/+-]/.test(body);
    if (hasClassLetter && hasPunctuation) found.push(text.slice(i, close + 1));
  }
  return found;
}

describe("no negated character class has lost a backslash", () => {
  it("the premise: it flags the class that shipped", () => {
    expect(mangledNegatedClasses("/^[^s@]+@[^s@]+.[^s@]+$/")).not.toEqual([]);
  });

  it("does not flag the correct form", () => {
    expect(mangledNegatedClasses("/^[^" + BS + "s@]+@[^" + BS + "s@]+$/")).toEqual([]);
  });

  it("does not flag a legitimate negated class of plain letters", () => {
    // "[^abc]" is a real thing to write; the signature is a class letter
    // sitting beside punctuation.
    expect(mangledNegatedClasses("/[^abc]/")).toEqual([]);
    expect(mangledNegatedClasses("/[^aeiou]/")).toEqual([]);
  });

  it("finds none in the codebase", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      if (file.endsWith("eaten-escapes.test.ts")) continue;
      const hits = mangledNegatedClasses(readFileSync(file, "utf8"));
      if (hits.length > 0) {
        offenders.push(file.slice(root.length + 1).split("\\").join("/") + ": " + hits.join(" | "));
      }
    }
    expect(offenders).toEqual([]);
  });
});
