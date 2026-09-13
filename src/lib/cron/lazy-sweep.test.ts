import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SweepRun } from "@/lib/heartbeat";

/**
 * The fallback that runs the sweep off ordinary traffic.
 *
 * Every reminder comes from a cron trigger, and that trigger is the one part of
 * the system that cannot be fixed from the codebase: Vercel only sends the
 * authorization header when CRON_SECRET is set. So the product's promise to
 * contact people was hostage to one environment variable, and on this account
 * that variable is not set.
 *
 * The rules that matter are all about NOT running: it must disable itself when
 * a real cron is healthy, and it must not stampede.
 */

const rpc = vi.fn();
const runReminders = vi.fn();
const checkFn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));
vi.mock("@/lib/rate-limit", () => ({
  check: (...args: unknown[]) => checkFn(...args),
}));
vi.mock("@/app/api/cron/daily/route", () => ({
  RUNNERS: {
    reminders: () => runReminders(),
    sync: vi.fn(),
    retention: vi.fn(),
    "source-watch": vi.fn(),
  },
}));

const { sweepIfScheduleIsDead } = await import("@/lib/cron/lazy-sweep");

/** sweep_health() rows, as the RPC returns them. */
const rows = (runs: Partial<SweepRun>[]) =>
  runs.map((r) => ({ job: r.job, last_ok_at: r.lastOkAt ?? null, last_failed_at: null }));

beforeEach(() => {
  rpc.mockReset();
  runReminders.mockReset().mockResolvedValue(new Response("{}"));
  checkFn.mockReset().mockResolvedValue({ ok: true, remaining: 0, retryAfterSeconds: 0 });
});
afterEach(() => vi.restoreAllMocks());

describe("it runs only when the schedule is genuinely dead", () => {
  it("runs when nothing has ever run", () => {
    // The state this account is in: cron_runs empty because the trigger never
    // reaches the route.
    rpc.mockResolvedValue({ data: [], error: null });
    return sweepIfScheduleIsDead().then((res) => {
      expect(res.ran).toEqual(["reminders"]);
      expect(runReminders).toHaveBeenCalledOnce();
    });
  });

  it("does nothing when the cron ran last night", async () => {
    // The whole point: a fallback that competes with a working scheduler is a
    // second system to go wrong. This one vanishes.
    const lastOkAt = new Date(Date.now() - 3 * 3_600_000).toISOString();
    rpc.mockResolvedValue({ data: rows([{ job: "reminders", lastOkAt }]), error: null });
    const res = await sweepIfScheduleIsDead();
    expect(res.ran).toEqual([]);
    expect(runReminders).not.toHaveBeenCalled();
  });

  it("leaves a merely-late job to the cron that is about to fire", async () => {
    // 30 hours is past the cadence and inside the grace window. Due, but not
    // evidence of an outage.
    const lastOkAt = new Date(Date.now() - 30 * 3_600_000).toISOString();
    rpc.mockResolvedValue({ data: rows([{ job: "reminders", lastOkAt }]), error: null });
    expect((await sweepIfScheduleIsDead()).ran).toEqual([]);
  });

  it("runs once the gap is a real outage", async () => {
    const lastOkAt = new Date(Date.now() - 14 * 24 * 3_600_000).toISOString();
    rpc.mockResolvedValue({ data: rows([{ job: "reminders", lastOkAt }]), error: null });
    expect((await sweepIfScheduleIsDead()).ran).toEqual(["reminders"]);
  });
});

describe("it does not stampede", () => {
  it("takes a durable claim, at most one an hour", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await sweepIfScheduleIsDead();
    expect(checkFn).toHaveBeenCalledWith("lazy-sweep", 1, 60 * 60 * 1000);
  });

  it("stands down when another render already claimed the hour", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    checkFn.mockResolvedValue({ ok: false, remaining: 0, retryAfterSeconds: 1200 });
    expect((await sweepIfScheduleIsDead()).ran).toEqual([]);
    expect(runReminders).not.toHaveBeenCalled();
  });

  it("stands down when the claim itself is unavailable", async () => {
    // check() fails OPEN when its RPC errors — right for a public form, wrong
    // here. A claim that cannot be taken must block, or one database hiccup
    // turns every concurrent render into its own sweep.
    rpc.mockResolvedValue({ data: [], error: null });
    checkFn.mockResolvedValue({ ok: true, remaining: 1, retryAfterSeconds: 0, degraded: true });
    expect((await sweepIfScheduleIsDead()).ran).toEqual([]);
    expect(runReminders).not.toHaveBeenCalled();
  });
});

describe("it never breaks the page it runs behind", () => {
  it("says nothing ran when the heartbeat cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await sweepIfScheduleIsDead()).ran).toEqual([]);
  });

  it("swallows a throwing job", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    runReminders.mockRejectedValue(new Error("send failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sweepIfScheduleIsDead()).resolves.toMatchObject({ ran: [] });
  });
});

describe("what it deliberately will not do", () => {
  it("never runs retention off a page view", async () => {
    // Retention DELETES data. That belongs on a schedule an operator chose, or
    // a deliberate press in /admin — not as a side effect of somebody opening
    // a page.
    rpc.mockResolvedValue({ data: [], error: null });
    const res = await sweepIfScheduleIsDead();
    expect(res.ran).not.toContain("retention");
    expect(res.ran).not.toContain("sync");
    expect(res.ran).not.toContain("source-watch");
  });
});
