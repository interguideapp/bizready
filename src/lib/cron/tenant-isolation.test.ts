import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One tenant's bad data must not decide whether anybody else is reminded.
 *
 * There was no try/catch anywhere in the reminders route. A single business
 * that threw — a malformed onboarding_answers, a template id no longer present
 * in content, a date that will not parse — propagated out of the fan-out loop,
 * and every business after it got nothing. endCronRun was never reached
 * either, so the run stayed unfinished and jobsDue kept it due, which meant the
 * next sweep hit the same row and starved the same tenants again.
 *
 * Ordering that fan-out by id, which pagination needs, made it deterministic
 * rather than random: the SAME businesses every night. The two changes belong
 * together, and this is the half that keeps the first one safe.
 *
 * Asserted at the source. Exercising the route would mean standing up the whole
 * notification stack against a fake Supabase, and the property is structural:
 * is the per-tenant work inside a boundary, and is a failure counted rather
 * than swallowed or fatal.
 */
const route = readFileSync(
  join(process.cwd(), "src/app/api/cron/reminders/route.ts"),
  "utf8"
);
const lines = route.split(/\r?\n/);

/** The fan-out loop's own lines, so nothing elsewhere can satisfy these. */
function loopBody(): string[] {
  const start = lines.findIndex((l) => l.trim() === "for (const biz of businesses) {");
  expect(start, "the fan-out loop is gone or renamed").toBeGreaterThan(-1);
  let end = start + 1;
  while (lines[end]?.trim() !== "}" || lines[end] !== "  }") {
    end++;
    if (end > lines.length) throw new Error("loop end not found");
  }
  return lines.slice(start, end + 1);
}

describe("the per-business work is isolated", () => {
  it("opens a try as the first thing inside the loop", () => {
    const body = loopBody();
    expect(body[1].trim()).toBe("try {");
  });

  it("catches, so one tenant cannot end the sweep", () => {
    expect(loopBody().join("\n")).toContain("} catch (e) {");
  });

  it("counts the failure rather than swallowing it", () => {
    // An empty catch would satisfy "isolated" and be worse than the crash: the
    // sweep would report success while a tenant silently got nothing forever.
    const body = loopBody().join("\n");
    expect(body).toContain("failedBusinesses++");
    expect(body).toContain("failures.push({ businessId: biz.id");
    expect(body).toContain("console.error");
  });

  it("keeps the count out of the loop, so it survives to the summary", () => {
    const before = lines.slice(0, lines.findIndex((l) => l.trim() === "for (const biz of businesses) {"));
    expect(before.join("\n")).toContain("let failedBusinesses = 0;");
  });
});

describe("the run records what happened", () => {
  it("puts the failure count and the ids in the summary", () => {
    expect(route).toContain("failedBusinesses,");
    expect(route).toContain("failures,");
  });

  it("derives the outcome instead of asserting one", () => {
    /**
     * This asserted the literal "ok: true", and it broke when the outcome
     * became derived — correctly, which is the point of having it.
     *
     * The intent it was protecting still holds and is unchanged: a few tenants
     * throwing must NOT mark the run failed, because a red heartbeat would tell
     * every user that delivery is down over one other account's bad data, and
     * would keep the job due so it retried that failure all night. What changed
     * is that "all of them threw" is now distinguished from "some did —
     * fanOutSucceeded owns that boundary and cron/outcome.test.ts exercises it
     * behaviourally, so this only has to check the route asks.
     */
    const summaryAt = route.indexOf("const summary = {");
    expect(summaryAt).toBeGreaterThan(-1);
    const summary = route.slice(summaryAt, summaryAt + 900);
    expect(summary).toContain("fanOutSucceeded(businesses.length, failedBusinesses)");
    expect(summary, "the outcome is hardcoded again").not.toContain("ok: true");
  });

  it("caps the recorded ids, so one broken deploy cannot bloat the row", () => {
    expect(route).toContain("failures.length < 20");
  });
});

describe("a partial READ is still a failure, unlike a partial fan-out", () => {
  it("records the run as failed when pagination breaks", () => {
    // Different case, opposite answer: not knowing the full tenant list means
    // the sweep cannot claim to have attempted everyone, so it must stay due.
    expect(route).toContain("endCronRun(supabase, run, false, {");
    expect(route).toContain("businessesRead: businesses.length");
  });
});
