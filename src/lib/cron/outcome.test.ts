import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fanOutSucceeded } from "@/lib/cron/outcome";

/**
 * Whether a fan-out sweep worked, decided once for both jobs that fan out.
 *
 * They answered differently and both were wrong at one end. sync hardcoded
 * `ok: true`, so a night where EVERY connection failed was recorded as a
 * healthy run — which matters more now that the integrations screen reports
 * this job's health: it would have said "הסנכרון הלילי פועל" while nothing
 * synced at all. reminders reported ok for any completed loop, which is right
 * for one broken tenant and wrong when the loop achieved nothing for anybody.
 */
describe("the boundary between a tenant problem and a job outage", () => {
  it("is ok when some worked and some failed", () => {
    // A red heartbeat here would tell every user the service is down because
    // one other account has bad credentials.
    expect(fanOutSucceeded(10, 1)).toBe(true);
    expect(fanOutSucceeded(10, 9)).toBe(true);
  });

  it("is NOT ok when everything failed", () => {
    // Not a tenant problem: the provider is unreachable, the key is wrong, the
    // schema moved.
    expect(fanOutSucceeded(10, 10)).toBe(false);
    expect(fanOutSucceeded(1, 1)).toBe(false);
  });

  it("is ok when there was nothing to do", () => {
    // An account with no connections is not a broken sync, and failing here
    // would put a permanent red mark on an idle job.
    expect(fanOutSucceeded(0, 0)).toBe(true);
  });

  it("is ok when nothing failed", () => {
    expect(fanOutSucceeded(250, 0)).toBe(true);
  });

  it("does not go wrong on impossible inputs", () => {
    // failed > attempted must not read as success by arithmetic accident.
    expect(fanOutSucceeded(2, 5)).toBe(false);
    expect(fanOutSucceeded(-1, 0)).toBe(true);
  });
});

describe("both fan-out sweeps use it", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

  it("sync no longer hardcodes a successful run", () => {
    const src = read("src/app/api/cron/sync/route.ts");
    expect(src).toContain("fanOutSucceeded(connections.length, failed)");
  });

  it("reminders uses the same rule over its own counts", () => {
    const src = read("src/app/api/cron/reminders/route.ts");
    expect(src).toContain("fanOutSucceeded(businesses.length, failedBusinesses)");
  });

  it("records the outcome the summary states, in every sweep", () => {
    // The row and the summary disagreeing about one run is its own defect: an
    // operator reads the summary, the heartbeat reads the column.
    for (const rel of [
      "src/app/api/cron/sync/route.ts",
      "src/app/api/cron/reminders/route.ts",
      "src/app/api/cron/retention/route.ts",
      "src/app/api/cron/source-watch/route.ts",
    ]) {
      expect(read(rel), `${rel} hardcodes the recorded outcome`).not.toMatch(
        /endCronRun\([^)]*,\s*true\s*,/
      );
    }
  });
});
