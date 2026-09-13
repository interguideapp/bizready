import { describe, expect, it } from "vitest";
import { ABANDONED_AFTER_MS, beginCronRun, endCronRun } from "@/lib/cron-run";

/**
 * Silence and failure are not the same news.
 *
 * sweep_health() reports last_ok_at from rows with `ok is true` and
 * last_failed_at from rows with `ok is false`. A crash writes NEITHER — the row
 * is opened and never closed — so a job crashing on every invocation looked
 * exactly like a job that was merely quiet. The user was told reminders were
 * not going out only once the gap reached "stale", which for reminders is 36
 * hours: a full day later than the evidence existed.
 *
 * beginCronRun now closes rows this job left open long enough ago to be
 * certainly dead, so `failing` is true on the very next attempt.
 *
 * The opposite error matters too. An open row can mean "a run is in progress",
 * and marking a live run failed would make the flag lie the other way, so only
 * rows past ABANDONED_AFTER_MS are touched.
 */

/** A fake client that records the calls a chain makes. */
function fakeSupabase() {
  const calls: Array<{ table: string; op: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const ctx: Record<string, unknown> = {};
      const chain = {
        // ctx is pushed BY REFERENCE, not spread: the filters are chained
        // AFTER update(), so a copy taken here would never see them. My first
        // version copied and three assertions failed on an empty filter set.
        update(values: Record<string, unknown>) {
          ctx.values = values;
          calls.push({ table, op: "update", args: ctx });
          return chain;
        },
        insert(values: Record<string, unknown>) {
          ctx.values = values;
          calls.push({ table, op: "insert", args: ctx });
          return chain;
        },
        eq(col: string, val: unknown) {
          ctx[`eq:${col}`] = val;
          return chain;
        },
        is(col: string, val: unknown) {
          ctx[`is:${col}`] = val;
          return chain;
        },
        lt(col: string, val: unknown) {
          ctx[`lt:${col}`] = val;
          return chain;
        },
        select() {
          return chain;
        },
        single() {
          return Promise.resolve({ data: { id: "run-1" }, error: null });
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

describe("an abandoned run is closed as failed", () => {
  it("closes only rows for the same job", async () => {
    const { client, calls } = fakeSupabase();
    await beginCronRun(client, "reminders");
    const close = calls.find((c) => c.op === "update")!;
    expect(close.args["eq:job"]).toBe("reminders");
  });

  it("closes only rows that never finished", async () => {
    const { client, calls } = fakeSupabase();
    await beginCronRun(client, "reminders");
    const close = calls.find((c) => c.op === "update")!;
    expect(close.args["is:finished_at"]).toBeNull();
  });

  it("leaves a run that could still be alive alone", async () => {
    /**
     * The opposite error. Nothing on this plan can still be running after 60
     * seconds (maxDuration), so the cutoff is well past any live invocation —
     * but it must exist, or a second concurrent begin would mark the first
     * run failed while it was still sending email.
     */
    const { client, calls } = fakeSupabase();
    const before = Date.now();
    await beginCronRun(client, "reminders");
    const close = calls.find((c) => c.op === "update")!;
    const cutoff = Date.parse(close.args["lt:started_at"] as string);
    expect(before - cutoff).toBeGreaterThanOrEqual(ABANDONED_AFTER_MS - 1000);
    expect(ABANDONED_AFTER_MS).toBeGreaterThan(60_000);
  });

  it("records it as a failure, not as a success", async () => {
    // The whole point: sweep_health's last_failed_at only reads `ok is false`.
    const { client, calls } = fakeSupabase();
    await beginCronRun(client, "reminders");
    const close = calls.find((c) => c.op === "update")!;
    const values = close.args.values as Record<string, unknown>;
    expect(values.ok).toBe(false);
    expect(values.finished_at).toBeTruthy();
  });

  it("says why, so an operator is not left guessing", async () => {
    const { client, calls } = fakeSupabase();
    await beginCronRun(client, "reminders");
    const values = (calls.find((c) => c.op === "update")!.args.values) as {
      detail: { abandoned: boolean };
    };
    expect(values.detail.abandoned).toBe(true);
  });

  it("still opens the new run", async () => {
    // Bookkeeping must never change the outcome of the work.
    const { client, calls } = fakeSupabase();
    const handle = await beginCronRun(client, "reminders");
    expect(handle.id).toBe("run-1");
    expect(calls.some((c) => c.op === "insert")).toBe(true);
  });

  it("opens the run even if closing the old one throws", async () => {
    const calls: string[] = [];
    const client = {
      from() {
        const chain: Record<string, unknown> = {};
        for (const m of ["eq", "is", "lt", "select"]) chain[m] = () => chain;
        chain.update = () => {
          throw new Error("permission denied");
        };
        chain.insert = () => {
          calls.push("insert");
          return chain;
        };
        chain.single = () => Promise.resolve({ data: { id: "run-2" }, error: null });
        return chain;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const handle = await beginCronRun(client, "reminders");
    expect(handle.id).toBe("run-2");
    expect(calls).toContain("insert");
  });
});

describe("endCronRun stays harmless", () => {
  it("does nothing without a handle, rather than throwing", async () => {
    const { client, calls } = fakeSupabase();
    await endCronRun(client, { id: null }, true);
    expect(calls).toEqual([]);
  });

  it("swallows its own failure, because monitoring must not break the job", async () => {
    const client = {
      from() {
        throw new Error("table missing");
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(endCronRun(client, { id: "x" }, true)).resolves.toBeUndefined();
  });

  it("caps an oversized detail instead of writing it whole", async () => {
    const { client, calls } = fakeSupabase();
    await endCronRun(client, { id: "x" }, true, { blob: "y".repeat(9000) });
    const values = (calls.find((c) => c.op === "update")!.args.values) as {
      detail: { truncated?: boolean };
    };
    expect(values.detail.truncated).toBe(true);
  });

  it("survives a detail that cannot be serialised", async () => {
    const { client, calls } = fakeSupabase();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    await endCronRun(client, { id: "x" }, false, cyclic);
    const values = (calls.find((c) => c.op === "update")!.args.values) as {
      detail: { unserialisable?: boolean };
    };
    expect(values.detail.unserialisable).toBe(true);
  });
});
