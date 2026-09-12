import { describe, expect, it } from "vitest";
import { JOB_PRIORITY, jobsDue } from "@/lib/cron/due";
import { SWEEP_SCHEDULE, type SweepRun } from "@/lib/heartbeat";

/**
 * What the one allowed cron invocation should run today.
 *
 * vercel.json declared four cron entries against a Vercel **Hobby** account,
 * which permits two — so the configuration was invalid and, as far as three
 * days of grouped runtime logs could show, not one /api/cron/* request ever
 * arrived. Every email, push and WhatsApp this product sends comes from that
 * sweep. Four entries collapse into one dispatcher, and this decides the rest.
 */

const NOW = "2026-09-13T06:00:00Z";
const run = (job: SweepRun["job"], lastOkAt: string | null): SweepRun => ({ job, lastOkAt });

describe("what is due", () => {
  it("runs everything when nothing has ever run", () => {
    // The state the project is actually in: cron_runs is empty because the
    // crons were never registered. Treating "no record" as "not due yet" would
    // keep it that way forever.
    expect(jobsDue([], NOW)).toEqual([...JOB_PRIORITY]);
  });

  it("runs the daily jobs a day later and leaves the weekly ones alone", () => {
    const yesterday = "2026-09-12T06:00:00Z";
    const due = jobsDue(
      [
        run("reminders", yesterday),
        run("sync", yesterday),
        run("retention", yesterday),
        run("source-watch", yesterday),
      ],
      NOW
    );
    expect(due).toEqual(["reminders", "sync"]);
  });

  it("runs nothing when everything ran hours ago", () => {
    const justNow = "2026-09-13T02:00:00Z";
    expect(
      jobsDue(
        [
          run("reminders", justNow),
          run("sync", justNow),
          run("retention", justNow),
          run("source-watch", justNow),
        ],
        NOW
      )
    ).toEqual([]);
  });

  it("brings a weekly job back once its week is up", () => {
    const weekAgo = "2026-09-06T04:30:00Z";
    const due = jobsDue([run("retention", weekAgo), run("source-watch", weekAgo)], NOW);
    expect(due).toContain("retention");
    expect(due).toContain("source-watch");
  });

  it("does not let an early trigger turn a daily job into every-other-day", () => {
    // Hobby fires within a window, not at an exact minute. Yesterday's run at
    // 07:00 and today's trigger at 06:00 is 23 hours — short of the 24-hour
    // cadence — and a strict comparison would skip today and wait until
    // tomorrow, halving the frequency of the one job that sends reminders.
    const due = jobsDue([run("reminders", "2026-09-12T07:00:00Z")], NOW);
    expect(due).toContain("reminders");
  });

  it("still refuses to run a daily job twice in one morning", () => {
    // The slack is an hour, not a licence to re-run: a second invocation the
    // same day must not re-send anything.
    expect(jobsDue([run("reminders", "2026-09-13T05:00:00Z")], NOW)).not.toContain("reminders");
  });

  it("orders by consequence, so a truncated invocation drops the cheapest", () => {
    // A single invocation has a wall-clock budget. Reminders are the only job
    // whose silence costs the user money; source-watch feeds a queue a human
    // reads anyway.
    expect(jobsDue([], NOW)[0]).toBe("reminders");
    expect(jobsDue([], NOW).at(-1)).toBe("source-watch");
  });

  it("ignores a last-failure timestamp when deciding cadence", () => {
    // lastFailedAt says the job ran and broke; it does not mean the work was
    // done. Only a success resets the clock.
    const due = jobsDue(
      [{ job: "reminders", lastOkAt: null, lastFailedAt: "2026-09-13T05:00:00Z" }],
      NOW
    );
    expect(due).toContain("reminders");
  });

  it("survives a malformed timestamp by running the job", () => {
    // An unreadable heartbeat must not silence the sweep — the failure mode
    // this whole file exists to prevent.
    expect(jobsDue([run("reminders", "not-a-date")], NOW)).toContain("reminders");
  });
});

describe("the dispatcher covers every scheduled job", () => {
  it("knows about all of them, so none can be orphaned by the collapse", () => {
    // Four vercel.json entries became one. If a job existed in the schedule and
    // not in the priority list it would simply never run again, silently —
    // which is the exact shape of the defect being fixed.
    expect([...JOB_PRIORITY].sort()).toEqual(Object.keys(SWEEP_SCHEDULE).sort());
  });
});
