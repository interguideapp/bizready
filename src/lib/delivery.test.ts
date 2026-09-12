import { describe, expect, it } from "vitest";
import { deliveryIsDown } from "@/lib/delivery";
import { allSweepHealth, needsAttention } from "@/lib/heartbeat";

/**
 * Telling the user that reminders are not going out.
 *
 * Every screen derives its own answer, so a dead scheduler cannot make a screen
 * wrong. What it makes wrong is the user's assumption: someone told the product
 * will email them before a deadline stops checking, and then nothing is
 * emailed. The screens stay honest and the silence lies.
 *
 * The heartbeat (029) has recorded exactly this since it shipped, and only
 * /admin read it — so the one person whose deadlines were at stake was the one
 * person not told.
 */
const NOW = "2026-09-13T09:00:00Z";
const health = (lastOkAt: string | null, lastFailedAt: string | null = null) =>
  allSweepHealth([{ job: "reminders", lastOkAt, lastFailedAt }], NOW).find(
    (h) => h.job === "reminders"
  )!;

describe("when to say it", () => {
  it("says it when the sweep has never run at all", () => {
    // The case that actually matters: an empty cron_runs table is a scheduler
    // that has not run once, and reporting that as healthy would be the worst
    // possible reading. allSweepHealth fills a missing job in as "never".
    const none = allSweepHealth([], NOW).find((h) => h.job === "reminders")!;
    expect(none.state).toBe("never");
    expect(deliveryIsDown(none)).toBe(true);
  });

  it("says it when the last run was long enough ago to be an outage", () => {
    expect(deliveryIsDown(health("2026-09-01T02:00:00Z"))).toBe(true);
  });

  it("says it when the last run FAILED, even if it ran recently", () => {
    // A job that runs on schedule and errors every time is not healthy, and
    // "hours since last success" alone would have called it late at worst.
    const h = health("2026-08-20T02:00:00Z", "2026-09-13T02:00:00Z");
    expect(h.failing).toBe(true);
    expect(deliveryIsDown(h)).toBe(true);
  });

  it("stays quiet for a single missed nightly run", () => {
    // A notice that fires on one skipped run gets ignored, and then the real
    // outage is invisible too. Same threshold the admin panel applies.
    //
    // 30 hours: past the 24-hour cadence, inside the 36-hour grace.
    const h = health("2026-09-12T03:00:00Z");
    expect(h.state).toBe("late");
    expect(deliveryIsDown(h)).toBe(false);
  });

  it("stays quiet when the sweep ran last night", () => {
    expect(deliveryIsDown(health("2026-09-13T02:00:00Z"))).toBe(false);
  });

  it("stays quiet when the health read itself failed", () => {
    // A monitoring read must never break, or scare someone about, the page it
    // is monitoring. With no answer we say nothing.
    expect(deliveryIsDown(null)).toBe(false);
  });
});

describe("the user surfaces and the admin panel agree about what is broken", () => {
  it("raises the user notice for exactly the states the admin panel raises", () => {
    const cases: (string | null)[] = [
      null,
      "2026-09-13T02:00:00Z",
      "2026-09-12T03:00:00Z",
      "2026-09-01T02:00:00Z",
      "2026-06-01T02:00:00Z",
    ];
    for (const lastOk of cases) {
      const h = health(lastOk);
      // needsAttention is the admin threshold; the only deliberate difference
      // is a failing-but-recent job, which the user is told about because it
      // means their reminders are silently erroring.
      const admin = needsAttention([h]).length > 0;
      expect(deliveryIsDown(h)).toBe(admin);
    }
  });
});
