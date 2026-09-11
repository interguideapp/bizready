import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static checks on the migration set.
 *
 * These cannot replace applying the migrations to a real Postgres — CI does
 * that, against a postgres:16 service, with around forty assertions about the
 * resulting schema. But there is no Postgres or Docker on this machine, so the
 * CI job is the only place that runs, and a broken migration would not surface
 * until a push.
 *
 * What these catch is the class of defect that actually bit me twice while
 * writing this set: dollar-quoting mangled by a shell or a JS string layer, so
 * `do $$` became `do $` and the file would abort at runtime while looking
 * perfectly fine in a diff. That is exactly the failure mode migration 013 had
 * originally — a file that aborts partway, taking later statements with it.
 */

const DIR = path.join(process.cwd(), "supabase/migrations");

function migrations(): { name: string; sql: string }[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(DIR, name), "utf8") }));
}

/**
 * Every .sql file CI applies, not only the numbered migrations.
 *
 * The stub file runs FIRST and defines auth.uid(), so if it aborts, every
 * assertion after it is describing a database that does not resemble
 * production. It earns the same scrutiny as a migration.
 */
function sqlFiles(): { name: string; sql: string }[] {
  const dirs = [DIR, path.join(process.cwd(), "supabase/ci")];
  return dirs.flatMap((dir) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((name) => ({
            name: path.relative(process.cwd(), path.join(dir, name)),
            sql: fs.readFileSync(path.join(dir, name), "utf8"),
          }))
      : []
  );
}

/**
 * Strip every VALID dollar-quote delimiter and return the leftovers.
 *
 * Valid is `$$` or `$tag$`, and a positional parameter like `$1` is fine too.
 * Anything left over is a delimiter that lost a character — which is exactly
 * how the CI stub's function-body opener became a bare `$` while the file still
 * read plausibly. The balance check below cannot see that case: zero
 * occurrences of `$$` is an even number.
 */
function orphanDollars(sql: string): string[] {
  const stripped = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n")
    // A `$` inside a quoted string is data, not a delimiter — 002 anchors a
    // username regex with one. SQL doubles an embedded quote, so consume that.
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*\$/g, "")
    .replace(/\$\$/g, "")
    .replace(/\$\d+/g, "");
  return stripped
    .split("\n")
    .filter((line) => line.includes("$"))
    .map((line) => line.trim());
}

describe("every migration is structurally sound", () => {
  it("no dollar-quote delimiter has lost a character", () => {
    // This bug has now happened twice, in two different ways: once mangling a
    // `do $$` into `do $`, and once turning a function body's opening `$$` into
    // `$` while leaving the total count even — so the balance check below
    // passed. A lone `$` is never valid in these files, so assert that
    // directly rather than asserting symmetry.
    const bad: string[] = [];
    for (const { name, sql } of sqlFiles()) {
      for (const line of orphanDollars(sql)) bad.push(`${name}: ${line}`);
    }
    expect(bad).toEqual([]);
  });

  it("the CI stub defines the auth function every policy depends on", () => {
    // auth.uid() was hardcoded to null, so not one policy or membership helper
    // could be exercised behaviourally — CI could only assert they existed.
    const stub = sqlFiles().find((f) => f.name.includes("00_supabase_stubs"));
    expect(stub, "the CI stub file is missing").toBeDefined();
    expect(stub!.sql).toMatch(/function auth\.uid/);
    expect(
      stub!.sql,
      "auth.uid() must read the session claim, not return a constant"
    ).toMatch(/request\.jwt\.claims/);
  });

  it("dollar-quoted blocks are balanced", () => {
    // `do $$ ... end $$;` — an odd count means one got truncated to `$`, which
    // is a syntax error at apply time and invisible on review.
    const bad: string[] = [];
    for (const { name, sql } of migrations()) {
      const opens = (sql.match(/\$\$/g) ?? []).length;
      if (opens % 2 !== 0) bad.push(`${name}: ${opens} occurrences of $$ (odd)`);
      // A lone `$` immediately after `do` or `end` is the mangled form.
      for (const m of sql.matchAll(/^\s*(do|end)\s+\$(?!\$)/gm)) {
        bad.push(`${name}: "${m[1]} $" — dollar quoting lost a character`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every migration is wrapped in a transaction", () => {
    // A file that applies half-way leaves the schema in a state no migration
    // describes. 013 originally aborted mid-file and silently took six policies
    // with it, which is what made this rule non-negotiable.
    const bad: string[] = [];
    for (const { name, sql } of migrations()) {
      const lower = sql.toLowerCase();
      const hasBegin = /^\s*begin\s*;/m.test(lower);
      const hasCommit = /^\s*commit\s*;/m.test(lower);
      // The initial schema and the early files predate the rule; everything
      // from 013 on is ours and must comply.
      const ordinal = Number(name.slice(0, 3));
      if (ordinal >= 13 && (!hasBegin || !hasCommit)) {
        bad.push(`${name}: begin=${hasBegin} commit=${hasCommit}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no migration silently destroys data", () => {
    // drop table / drop column / truncate / an unfiltered delete. If one of
    // these is ever genuinely needed it should be obvious in review, not
    // discovered afterwards.
    const bad: string[] = [];
    for (const { name, sql } of migrations()) {
      const stripped = sql
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .toLowerCase();
      for (const pattern of [
        /\bdrop\s+table\b/,
        /\bdrop\s+column\b/,
        /\btruncate\b/,
        // A delete with no where clause.
        /\bdelete\s+from\s+[\w.]+\s*;/,
      ]) {
        const m = stripped.match(pattern);
        if (m) bad.push(`${name}: "${m[0].trim()}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("object creation is idempotent, so a re-run is safe", () => {
    // Everything from 013 on may be applied to a database that already has
    // some of it — production was built partly out-of-band.
    const bad: string[] = [];
    for (const { name, sql } of migrations()) {
      if (Number(name.slice(0, 3)) < 13) continue;
      const stripped = sql
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n");
      for (const m of stripped.matchAll(/create\s+(table|index)\s+(?!if\s+not\s+exists)/gi)) {
        bad.push(`${name}: "create ${m[1]}" without "if not exists"`);
      }
      // A policy cannot be created conditionally, so it must be dropped first.
      for (const m of stripped.matchAll(/^\s*create\s+policy\s+"([^"]+)"/gim)) {
        const policy = m[1];
        const dropped = stripped.includes(`drop policy if exists "${policy}"`);
        if (!dropped) bad.push(`${name}: policy "${policy}" created without a prior drop`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("numbering is contiguous and unique", () => {
    // Two files with the same ordinal is how the duplicate 002 happened: both
    // added the same column and whichever ran second aborted.
    const ordinals = migrations().map((m) => Number(m.name.slice(0, 3)));
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const n of ordinals) {
      if (seen.has(n)) duplicates.push(n);
      seen.add(n);
    }
    expect(duplicates).toEqual([]);

    const gaps: number[] = [];
    for (let n = Math.min(...ordinals); n <= Math.max(...ordinals); n++) {
      if (!seen.has(n)) gaps.push(n);
    }
    expect(gaps).toEqual([]);
  });

  it("every migration explains itself", () => {
    // These encode legal and security decisions. A header comment is how the
    // next person learns why a trigger exists rather than deleting it.
    const bad: string[] = [];
    for (const { name, sql } of migrations()) {
      if (Number(name.slice(0, 3)) < 13) continue;
      const firstLines = sql.split("\n").slice(0, 4).join("\n");
      if (!/^\s*--/.test(firstLines)) bad.push(`${name}: no header comment`);
    }
    expect(bad).toEqual([]);
  });
});
