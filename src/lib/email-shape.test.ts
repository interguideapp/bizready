import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { looksLikeEmailAddress, normaliseEmailAddress } from "@/lib/email-shape";

/**
 * THE PUBLIC PARTNER FORM REJECTED EVERY ADDRESS CONTAINING THE LETTER S.
 *
 * actions.ts validated it with a character class that had lost its backslash
 * level, so instead of "not whitespace, not @" it read "not the letter s, not
 * @". moshe@business.co.il, yossi@post.co.il, anything at a domain with an s
 * in it — all answered "כתובת האימייל לא נראית תקינה". A valid address turned
 * away from a public funnel, with a message blaming the applicant.
 *
 * Three other copies of the same expression, elsewhere in the codebase, were
 * spelled correctly. That is precisely why it survived: the pattern is
 * familiar, it appears right at a glance, and the broken copy sat alone.
 *
 * Same family as the two dead validators in markPeriodFiled and
 * setTaskDueDate, and the same remedy: one definition, tested against real
 * values rather than only read.
 */
describe("real addresses pass", () => {
  it("accepts an address whose domain holds the letter the mangled class banned", () => {
    // The exact case that was rejected in production.
    expect(looksLikeEmailAddress("moshe@business.co.il")).toBe(true);
    expect(looksLikeEmailAddress("yossi@post.co.il")).toBe(true);
  });

  it("accepts every letter of the alphabet in the local part", () => {
    // A mangled class bans one specific letter, so sweeping them all is what
    // makes this guard general rather than a fix for the one report.
    for (const ch of "abcdefghijklmnopqrstuvwxyz") {
      expect(looksLikeEmailAddress(`${ch}${ch}x@example.com`), ch).toBe(true);
    }
  });

  it("accepts digits, dots, plus and hyphens, which real addresses use", () => {
    for (const address of [
      "a.b@example.com",
      "a+tag@example.co.il",
      "a-b@sub.example.com",
      "user2026@example.com",
    ]) {
      expect(looksLikeEmailAddress(address), address).toBe(true);
    }
  });
});

describe("malformed input is still refused", () => {
  it("rejects an entry with no at-sign, which is the whole point of the check", () => {
    expect(looksLikeEmailAddress("no-at-sign")).toBe(false);
  });

  it("rejects whitespace, which is what the class was meant to exclude", () => {
    expect(looksLikeEmailAddress("sp ace@example.com")).toBe(false);
    expect(looksLikeEmailAddress("a@exa mple.com")).toBe(false);
  });

  it("rejects a domain with no dot", () => {
    expect(looksLikeEmailAddress("a@b")).toBe(false);
  });

  it("rejects empty and whitespace-only input", () => {
    expect(looksLikeEmailAddress("")).toBe(false);
    expect(looksLikeEmailAddress("   ")).toBe(false);
  });
});

describe("normalisation", () => {
  it("trims and lowercases, which is how an address is compared and stored", () => {
    expect(normaliseEmailAddress("  Moshe@Business.CO.IL ")).toBe("moshe@business.co.il");
  });

  it("does not strip dots or plus suffixes", () => {
    // Deliberate: those are different mailboxes at some providers, and
    // deciding otherwise is not ours to do.
    expect(normaliseEmailAddress("a.b+tag@example.com")).toBe("a.b+tag@example.com");
  });
});

describe("there is one definition, not four", () => {
  /**
   * The duplication is what made a single wrong copy invisible. A new one
   * appearing is the regression, and it is silent: three of four being right
   * is exactly the state this was found in.
   */
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(full) ? [full] : [];
    });
  }

  const root = process.cwd();

  it("no file outside lib/email-shape spells out an email pattern", () => {
    const offenders: string[] = [];
    for (const file of walk(join(root, "src"))) {
      const rel = file.slice(root.length + 1).split("\\").join("/");
      // This file and the shape itself, plus eaten-escapes.test.ts, which
      // holds the mangled pattern as a FIXTURE for its own detector. A guard
      // flagging another guard's test data is the same self-matching trap the
      // promises sweep hit when it matched the comment explaining a fix — and
      // an exemption is only safe when it is named, so these three are.
      if (
        rel === "src/lib/email-shape.ts" ||
        rel === "src/lib/email-shape.test.ts" ||
        rel === "src/lib/eaten-escapes.test.ts"
      ) {
        continue;
      }
      const src = readFileSync(file, "utf8");
      // The signature of an inline email check: an at-sign inside a regex
      // between two character classes.
      for (const line of src.split("\n")) {
        if (!line.includes("@")) continue;
        if (!/\/\^?\[\^?[^\]]*\]\+?@/.test(line)) continue;
        offenders.push(rel + ": " + line.trim());
      }
    }
    expect(offenders).toEqual([]);
  });
});
