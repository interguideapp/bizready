import { describe, expect, it } from "vitest";
import {
  allSweepHealth,
  needsAttention,
  sweepHealth,
  sweepSummary,
  SWEEP_SCHEDULE,
  type SweepJob,
} from "./heartbeat";

const now = "2026-09-12T06:00:00Z";

describe("has the scheduled work run", () => {
  it("calls a job that ran this morning healthy", () => {
    const h = sweepHealth({ job: "reminders", lastOkAt: "2026-09-12T05:00:00Z" }, now);
    expect(h.state).toBe("ok");
    expect(h.hoursSince).toBe(1);
  });

  it("calls a daily job late after a missed run, not broken", () => {
    // A single miss is usually a platform hiccup. Escalating immediately would
    // train whoever sees this to ignore it, and then a real outage is invisible.
    const h = sweepHealth({ job: "reminders", lastOkAt: "2026-09-11T00:00:00Z" }, now);
    expect(h.state).toBe("late");
  });

  it("calls it stale once it is past the grace period", () => {
    const h = sweepHealth({ job: "reminders", lastOkAt: "2026-09-10T00:00:00Z" }, now);
    expect(h.state).toBe("stale");
  });

  it("distinguishes never-ran from stale", () => {
    // Different causes: never wired up, versus wired up and broken. The fix is
    // different too, so the label has to be.
    expect(sweepHealth({ job: "reminders", lastOkAt: null }, now).state).toBe("never");
  });

  it("notes that the last attempt failed, not merely that it is late", () => {
    const h = sweepHealth(
      {
        job: "reminders",
        lastOkAt: "2026-09-11T06:00:00Z",
        lastFailedAt: "2026-09-12T06:00:00Z",
      },
      now
    );
    expect(h.failing).toBe(true);
  });

  it("does not report failing when the failure predates the last success", () => {
    const h = sweepHealth(
      {
        job: "reminders",
        lastOkAt: "2026-09-12T06:00:00Z",
        lastFailedAt: "2026-09-10T06:00:00Z",
      },
      now
    );
    expect(h.failing).toBe(false);
  });

  it("uses the weekly window for a weekly job", () => {
    // Judging retention by the daily cadence would mark it stale every week.
    const fiveDays = sweepHealth({ job: "retention", lastOkAt: "2026-09-07T04:30:00Z" }, now);
    expect(fiveDays.state).toBe("ok");
    const threeWeeks = sweepHealth({ job: "retention", lastOkAt: "2026-08-20T04:30:00Z" }, now);
    expect(threeWeeks.state).toBe("stale");
  });

  it("survives an unparseable timestamp instead of reporting healthy", () => {
    // Defaulting to "ok" on bad input is how a monitor lies.
    expect(sweepHealth({ job: "reminders", lastOkAt: "yesterday" }, now).state).toBe("never");
  });
});

describe("what is worth interrupting someone about", () => {
  it("raises a stale critical job", () => {
    const alerts = needsAttention(
      allSweepHealth([{ job: "reminders", lastOkAt: "2026-09-01T00:00:00Z" }], now)
    );
    expect(alerts.some((a) => a.job === "reminders")).toBe(true);
  });

  it("raises a job that has never run", () => {
    // Every job with no row at all shows up, which is the state a project has
    // before anyone confirms the scheduler works.
    const alerts = needsAttention(allSweepHealth([], now));
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.state === "never")).toBe(true);
  });

  it("stays quiet about a merely late job", () => {
    // Every job has to be supplied: an unsupplied critical job is correctly
    // "never ran", which is its own alert. Writing this test the lazy way
    // proved that, so it is written the honest way.
    const alerts = needsAttention(
      allSweepHealth(
        [
          { job: "reminders", lastOkAt: "2026-09-11T00:00:00Z" },
          { job: "sync", lastOkAt: "2026-09-12T03:00:00Z" },
          { job: "retention", lastOkAt: "2026-09-07T04:30:00Z" },
          { job: "source-watch", lastOkAt: "2026-09-07T05:00:00Z" },
        ],
        now
      )
    );
    expect(alerts).toEqual([]);
  });

  it("stays quiet about a non-critical job being stale", () => {
    // Stale invoice sync makes the money figures old, not wrong. Reminders not
    // firing costs the user a penalty, which is the difference.
    const health = allSweepHealth(
      [
        { job: "reminders", lastOkAt: "2026-09-12T05:00:00Z" },
        { job: "sync", lastOkAt: "2026-08-01T03:00:00Z" },
        { job: "retention", lastOkAt: "2026-09-07T04:30:00Z" },
        { job: "source-watch", lastOkAt: "2026-09-07T05:00:00Z" },
      ],
      now
    );
    expect(needsAttention(health)).toEqual([]);
  });

  it("treats the reminder sweep as critical, because its silence costs money", () => {
    expect(SWEEP_SCHEDULE.reminders.critical).toBe(true);
    expect(SWEEP_SCHEDULE.retention.critical).toBe(true);
    expect(SWEEP_SCHEDULE.sync.critical).toBe(false);
  });

  it("covers every scheduled job, with no job missing a schedule", () => {
    const health = allSweepHealth([], now);
    const jobs = Object.keys(SWEEP_SCHEDULE) as SweepJob[];
    expect(health.map((h) => h.job).sort()).toEqual([...jobs].sort());
  });
});

describe("the one-line summary", () => {
  it("says days when it has been days", () => {
    const h = sweepHealth({ job: "reminders", lastOkAt: "2026-09-09T06:00:00Z" }, now);
    expect(sweepSummary(h)).toContain("3 ימים");
  });

  it("says hours when it has been hours", () => {
    const h = sweepHealth({ job: "reminders", lastOkAt: "2026-09-12T00:00:00Z" }, now);
    expect(sweepSummary(h)).toContain("שעות");
  });

  it("leads with failure when the last attempt errored", () => {
    const h = sweepHealth(
      { job: "reminders", lastOkAt: "2026-09-11T06:00:00Z", lastFailedAt: now },
      now
    );
    expect(sweepSummary(h)).toContain("נכשלה");
  });

  it("says so plainly when it has never run", () => {
    expect(sweepSummary(sweepHealth({ job: "reminders", lastOkAt: null }, now))).toContain(
      "מעולם"
    );
  });
});
