import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The sweep and the screens must be fed the same columns.
 *
 * This is the failure mode that has actually shipped TWICE, and both times the
 * logic was correct and the data was not:
 *
 *   the cron's select omitted `dismissal`, so the prerequisite gate — written
 *     precisely to stop a new עוסק being told they were late for a duty that
 *     did not exist yet — ran on undefined and let the alarm through;
 *
 *   it later omitted the filing ledger, so the cycle decision fell back to the
 *     stored deadline while the screens read the ledger, and the two disagreed
 *     about whether a reporting period was open.
 *
 * Neither was catchable by a unit test of the engine: computeReminders was
 * right both times. What was wrong was the query in front of it. one-truth.ts
 * asserts the two REACH the same conclusion given the same input; this asserts
 * they are actually GIVEN the same input.
 *
 * Source-level on purpose. The alternative is mocking Supabase, which would
 * assert that the mock matches the mock.
 */
const root = process.cwd();

/** Every field ReminderTask declares, from the interface itself. */
function reminderTaskFields(): string[] {
  const src = readFileSync(join(root, "src/lib/reminders.ts"), "utf8");
  const start = src.indexOf("export interface ReminderTask {");
  const body = src.slice(start, src.indexOf("\n}", start));
  return [...body.matchAll(/^\s{2}([a-z_]+)\??:/gm)].map((m) => m[1]);
}

/** The columns the cron asks the database for. */
function cronSelectedColumns(): string[] {
  const src = readFileSync(join(root, "src/app/api/cron/reminders/route.ts"), "utf8");
  const from = src.indexOf('.from("business_tasks")');
  const select = /\.select\(\s*"([^"]+)"/.exec(src.slice(from));
  if (!select) throw new Error("could not find the business_tasks select");
  return select[1].split(",").map((c) => c.trim());
}

/** The fields loadAttention hands the engine on the read path. */
function attentionMappedFields(): string[] {
  const src = readFileSync(join(root, "src/lib/attention.ts"), "utf8");
  const start = src.indexOf("tasks.map((t) => ({");
  const body = src.slice(start, src.indexOf("})),", start));
  return [...body.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]);
}

describe("the engine's inputs are all actually supplied", () => {
  it("reads the interface, the query and the mapping, so it cannot pass vacuously", () => {
    expect(reminderTaskFields().length).toBeGreaterThan(8);
    expect(cronSelectedColumns().length).toBeGreaterThan(8);
    expect(attentionMappedFields().length).toBeGreaterThan(8);
  });

  it("the cron selects every column the engine declares", () => {
    // filed_periods is not a column on business_tasks — it comes from the
    // task_filings ledger and is attached separately, so it is exempt from the
    // select and checked on its own below.
    const fromLedger = new Set(["filed_periods"]);
    const selected = new Set(cronSelectedColumns());
    const missing = reminderTaskFields().filter(
      (f) => !fromLedger.has(f) && !selected.has(f)
    );
    expect(missing).toEqual([]);
  });

  it("the cron attaches the filing ledger, which is not a column", () => {
    const src = readFileSync(join(root, "src/app/api/cron/reminders/route.ts"), "utf8");
    expect(src).toContain('.from("task_filings")');
    expect(src).toMatch(/filed_periods:\s*filedByTemplate\.get/);
  });

  it("the read path maps every field the engine declares", () => {
    const mapped = new Set(attentionMappedFields());
    const missing = reminderTaskFields().filter((f) => !mapped.has(f));
    expect(missing).toEqual([]);
  });

  it("and the archive reaches both, since the expiry watch is silent without it", () => {
    const cron = readFileSync(join(root, "src/app/api/cron/reminders/route.ts"), "utf8");
    const attention = readFileSync(join(root, "src/lib/attention.ts"), "utf8");
    for (const [name, src] of [["cron", cron], ["attention", attention]] as const) {
      expect(src, name).toMatch(/expires_at/);
    }
  });
});
