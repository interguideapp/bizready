import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY COLUMN OF THE TRAIL IS EITHER SIGNED OR CONSCIOUSLY EXCLUDED.
 *
 * The hash covers a fixed list of fields. That is correct — a signature has to
 * choose what it signs — and it is also a quiet trap: add a column to
 * task_events and it is unsigned, so tampering with it is undetectable while
 * the evidence pack reports the content intact. The pack would be telling the
 * truth about the twelve fields it checked and the wrong thing to the reader.
 *
 * Nothing would fail. The trigger still writes, the chain still links, every
 * hash still re-derives, and the new column simply is not in the calculation.
 * The only moment anyone could notice is the moment someone relies on it.
 *
 * So the column list is derived from the migration set and compared against
 * the payload expression. A new column fails the build until it is either
 * added to the signature or listed below with a reason.
 *
 * WHY THE EXCLUSIONS ARE NOT SIMPLY FIXED: changing the payload re-defines
 * what was signed, so every hash already written stops re-deriving and the
 * pack reports "tampered" on rows nobody touched. That false accusation, in a
 * document meant to prove good standing, is the worst failure this feature
 * has. Adding a field to the signature is therefore a migration that also has
 * to re-sign or fence off the existing rows — a deliberate act, not a tidy-up.
 */
const root = process.cwd();

/** Columns of task_events, read from the migrations that create them. */
function trailColumns(): string[] {
  const dir = join(root, "supabase", "migrations");
  const names = new Set<string>();
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(dir, file), "utf8");

    // create table public.task_events ( ... );
    const at = sql.indexOf("create table public.task_events");
    if (at !== -1) {
      const body = sql.slice(sql.indexOf("(", at) + 1, sql.indexOf(");", at));
      for (const line of body.split("\n")) {
        const m = line.trim().match(/^([a-z_][a-z0-9_]*)\s+[a-z]/);
        if (m && !["primary", "foreign", "unique", "check", "constraint"].includes(m[1])) {
          names.add(m[1]);
        }
      }
    }

    // alter table public.task_events add column [if not exists] x type
    for (const m of sql.matchAll(
      /alter table public\.task_events\s+add column (?:if not exists )?([a-z_][a-z0-9_]*)/g
    )) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

/** Fields named inside the payload expression that produces the hash. */
function signedColumns(): string[] {
  const sql = readFileSync(
    join(root, "supabase", "migrations", "032_evidence_content_check.sql"),
    "utf8"
  );
  const at = sql.indexOf("create or replace function public.task_events_payload");
  expect(at, "the payload function is missing").toBeGreaterThan(-1);
  const body = sql.slice(at, sql.indexOf("$fn$;", at));
  return [...new Set([...body.matchAll(/\be\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]))].sort();
}

/**
 * Not signed, each for a reason that has been thought about.
 *
 * Short by design: every entry here is a field whose tampering the pack cannot
 * detect, so the list is the honest statement of this feature's limits.
 */
const NOT_SIGNED = new Map<string, string>([
  [
    "hash",
    "the signature itself — it cannot be an input to its own computation",
  ],
  [
    "id",
    "the surrogate primary key. The row's identity within the trail is seq, " +
      "which IS signed, and its meaning is in business_id/task_id/kind/detail/" +
      "created_at, all signed. Changing id alters no evidence; it would only " +
      "misdirect the brokenAt pointer in the report.",
  ],
]);

describe("the signature covers the trail", () => {
  it("the premise: both lists were actually read", () => {
    // Either regex silently matching nothing would make this vacuous — the
    // failure mode that has cost this codebase more than any other.
    expect(trailColumns().length).toBeGreaterThan(10);
    expect(signedColumns().length).toBeGreaterThan(10);
  });

  it("every column is signed or listed as deliberately unsigned", () => {
    const unaccounted = trailColumns().filter(
      (c) => !signedColumns().includes(c) && !NOT_SIGNED.has(c)
    );
    expect(
      unaccounted,
      "a new task_events column is not in the hash: sign it, or list it in " +
        "NOT_SIGNED with the reason tampering with it cannot be detected"
    ).toEqual([]);
  });

  it("nothing is listed as unsigned while actually being signed", () => {
    // A stale exclusion understates what the pack proves, which is the safer
    // direction and still wrong — the list is the feature's stated limits.
    const contradictory = [...NOT_SIGNED.keys()].filter((c) => signedColumns().includes(c));
    expect(contradictory).toEqual([]);
  });

  it("the exclusion list names only real columns", () => {
    const phantom = [...NOT_SIGNED.keys()].filter((c) => !trailColumns().includes(c));
    expect(phantom).toEqual([]);
  });

  it("the fields that carry the evidence are all signed", () => {
    // Named explicitly rather than left to the diff: these are what a reader
    // of the pack is relying on.
    for (const column of [
      "business_id",
      "task_id",
      "template_id",
      "kind",
      "from_status",
      "to_status",
      "detail",
      "actor_id",
      "actor_kind",
      "created_at",
      "seq",
      "prev_hash",
    ]) {
      expect(signedColumns(), column).toContain(column);
    }
  });
});
