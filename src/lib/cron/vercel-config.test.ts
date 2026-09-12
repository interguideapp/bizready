import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_PRIORITY } from "@/lib/cron/due";

/**
 * The cron configuration must be one the account can actually run.
 *
 * This is the defect that made every other reminder fix moot. vercel.json
 * declared FOUR cron entries; the Vercel account is on the Hobby plan, which
 * permits a maximum of TWO cron jobs per project. The configuration was
 * therefore invalid, nothing was registered, and three days of grouped runtime
 * logs showed not one /api/cron/* request arriving — while the product told
 * users it would email them before their deadlines.
 *
 * Nothing in the repo encoded the limit, so nothing could catch it. This does.
 * It is deliberately asserted against the plan the project is on rather than
 * against a comment: if the account is upgraded, this test is the place that
 * records the decision to rely on it.
 */

/** Vercel Hobby: at most 2 cron jobs per project, invoked at most once a day. */
const HOBBY_MAX_CRONS = 2;

/** Vercel Hobby: functions may run for at most 60 seconds. */
const HOBBY_MAX_DURATION_SECONDS = 60;

const root = process.cwd();

function vercelConfig(): { crons?: { path: string; schedule: string }[] } {
  return JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
}

describe("vercel.json fits the plan", () => {
  it("declares no more cron jobs than Hobby allows", () => {
    const crons = vercelConfig().crons ?? [];
    expect(crons.length).toBeLessThanOrEqual(HOBBY_MAX_CRONS);
  });

  it("asks for no schedule more frequent than once a day", () => {
    // Hobby invokes a cron at most once per day. A schedule like "0 * * * *"
    // would be rejected, taking the whole configuration with it.
    for (const cron of vercelConfig().crons ?? []) {
      const [minute, hour] = cron.schedule.split(/\s+/);
      expect(minute, `${cron.path} minute field`).not.toBe("*");
      expect(hour, `${cron.path} hour field`).not.toBe("*");
    }
  });

  it("points every cron at a route that exists", () => {
    // A typo'd path is a cron that registers and 404s every night, which looks
    // like a working schedule in the dashboard.
    for (const cron of vercelConfig().crons ?? []) {
      const file = join(root, "src", "app", cron.path.replace(/^\//, ""), "route.ts");
      expect(() => readFileSync(file, "utf8"), cron.path).not.toThrow();
    }
  });

  it("routes the single entry at the dispatcher, not at one job", () => {
    // With one slot and four jobs, pointing it at a single job would leave the
    // other three permanently unrun — the same silent outcome, narrower.
    const paths = (vercelConfig().crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/daily");
  });
});

describe("every cron route fits the plan's execution limit", () => {
  it("declares no maxDuration above the Hobby ceiling", () => {
    // sync asked for 300 seconds. Hobby grants 60, so the extra 240 was a
    // number that read as a guarantee and was not one.
    const offenders: string[] = [];
    for (const job of [...JOB_PRIORITY, "daily"]) {
      const src = readFileSync(join(root, "src/app/api/cron", job, "route.ts"), "utf8");
      const declared = /export const maxDuration = (\d+);/.exec(src);
      if (declared && Number(declared[1]) > HOBBY_MAX_DURATION_SECONDS) {
        offenders.push(`${job}: ${declared[1]}s`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps each job individually authorized, for a manual re-run", () => {
    // The dispatcher calls these directly, but they remain the way a single
    // failed job is re-run by hand — and they run with the service role, so
    // they must each fail closed on their own.
    for (const job of [...JOB_PRIORITY, "daily"]) {
      const src = readFileSync(join(root, "src/app/api/cron", job, "route.ts"), "utf8");
      expect(src, job).toContain("cronAuthorized(request)");
    }
  });
});
