import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSweepHealth, jobIsDown } from "@/lib/heartbeat";
import { JOB_PRIORITY } from "@/lib/cron/due";

/**
 * The integrations screen may not hedge about whether the nightly sync runs.
 *
 * It read: "הסנכרון האוטומטי הלילי פועל ברקע כשמוגדר מפתח השירות" — runs in
 * the background when the service key is configured. That is a condition the
 * reader has no way to evaluate, the same non-answer the admin panel once gave
 * about CRON_SECRET ("שווה לבדוק ש-CRON_SECRET מוגדר" — advice, not an answer).
 * The page is a server component and the heartbeat records every job's last
 * success, so it can simply look.
 *
 * It matters more than the wording suggests. Reminders have a fallback — the
 * lazy sweep runs them off any page render — and sync deliberately does NOT:
 * see lib/cron/lazy-sweep.ts, which runs reminders only because retention
 * deletes data and must never fire off a page view. So when the schedule is
 * dead, revenue is whatever was last pulled by hand, and revenue feeds the
 * עוסק פטור ceiling. Someone who believes the figures refresh nightly is
 * trusting a percentage that may be months stale.
 */
const NOW = "2026-09-13T09:00:00Z";
const sync = (lastOkAt: string | null) =>
  allSweepHealth([{ job: "sync", lastOkAt, lastFailedAt: null }], NOW).find(
    (h) => h.job === "sync"
  )!;

describe("the heartbeat can answer the question", () => {
  it("reports never when the job has not run", () => {
    expect(sync(null).state).toBe("never");
  });

  it("reports a healthy state after a recent run", () => {
    expect(["ok", "late"]).toContain(sync("2026-09-13T03:00:00Z").state);
  });

  it("reports stale once it is well past its grace", () => {
    expect(sync("2026-08-01T03:00:00Z").state).toBe("stale");
  });
});

describe("the predicate the page uses", () => {
  /**
   * Tested as behaviour, not as a string in the page.
   *
   * My first version of this file asserted only that the page mentioned
   * autoSyncRunning and read the heartbeat. I planted the flag hardwired on —
   * "true || Boolean(...)", the exact regression — and it PASSED, because the
   * presence of a name says nothing about what it computes. So the judgement
   * lives in jobIsDown and is checked here directly.
   */
  it("calls a job that never ran down", () => {
    expect(jobIsDown(sync(null))).toBe(true);
  });

  it("calls a long-dead job down", () => {
    expect(jobIsDown(sync("2026-08-01T03:00:00Z"))).toBe(true);
  });

  it("does not call a single missed run down", () => {
    // Otherwise the notice fires on ordinary jitter and gets ignored, and then
    // the real outage is invisible too.
    // 30 hours: past the 24-hour cadence, inside the 48-hour grace that
    // SWEEP_SCHEDULE gives sync. My first fixture was 54 hours old and the
    // test correctly called it stale.
    const late = sync("2026-09-12T03:00:00Z");
    expect(late.state).toBe("late");
    expect(jobIsDown(late)).toBe(false);
  });

  it("calls a job that runs and errors every time down", () => {
    const failing = allSweepHealth(
      [{ job: "sync", lastOkAt: "2026-08-20T03:00:00Z", lastFailedAt: "2026-09-13T03:00:00Z" }],
      NOW
    ).find((h) => h.job === "sync")!;
    expect(failing.failing).toBe(true);
    expect(jobIsDown(failing)).toBe(true);
  });

  it("says nothing when the health read itself failed", () => {
    expect(jobIsDown(null)).toBe(false);
    expect(jobIsDown(undefined)).toBe(false);
  });

  it("is the definition delivery.ts uses too, not a second copy", () => {
    const delivery = readFileSync(join(process.cwd(), "src/lib/delivery.ts"), "utf8");
    expect(delivery).toContain("jobIsDown(health.sweep)");
  });

  it("is what the page derives its flag from", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/integrations/page.tsx"), "utf8");
    expect(page).toContain("!jobIsDown(syncHealth)");
  });
});


describe("sync genuinely has no fallback, unlike reminders", () => {
  it("the lazy sweep runs reminders only", () => {
    // This is why the honest answer for sync is stronger than for reminders:
    // there is nothing else that can run it.
    const sweep = readFileSync(join(process.cwd(), "src/lib/cron/lazy-sweep.ts"), "utf8");
    expect(sweep).toMatch(/reminders/);
    expect(sweep).not.toMatch(/runJob\(["']sync["']\)|jobs:\s*\[[^\]]*sync/);
  });

  it("sync is still a job the dispatcher knows about", () => {
    // If it were not, the heartbeat row would never appear and the page could
    // not report on it at all.
    expect(JOB_PRIORITY).toContain("sync");
  });
});

describe("the page states it rather than hedging", () => {
  const shipped = readFileSync(
    join(process.cwd(), "src/app/(app)/integrations/page.tsx"),
    "utf8"
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("drops the unverifiable condition", () => {
    expect(shipped).not.toContain("כשמוגדר מפתח השירות");
  });

  it("reads the heartbeat for the sync job", () => {
    expect(shipped).toContain('h.job === "sync"');
    expect(shipped).toContain("autoSyncRunning");
  });

  it("says outright when it is not running", () => {
    expect(shipped).toContain("הסנכרון הלילי אינו פעיל כרגע");
  });

  it("names the consequence inside the not-running branch itself", () => {
    /**
     * Scoped to the branch. Asserting the phrase file-wide PASSED when I
     * planted its removal, because "תקרת עוסק פטור" also appears in the
     * read-only benefits list higher up the page — a guard matching a
     * different line than the one it is guarding.
     */
    const from = shipped.indexOf("הסנכרון הלילי אינו פעיל כרגע");
    expect(from).toBeGreaterThan(-1);
    const branch = shipped.slice(from, shipped.indexOf("</p>", from));
    expect(branch, "the branch no longer names the ceiling").toContain("תקרת");
    expect(branch).toContain("סנכרן עכשיו");
  });

  it("points at the manual action that does work", () => {
    expect(shipped).toMatch(/סנכרן עכשיו/);
  });
});
