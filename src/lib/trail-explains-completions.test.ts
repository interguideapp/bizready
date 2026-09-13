import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every completion has to be explainable from the trail.
 *
 * Measured on the live database rather than reasoned about: four tasks were
 * `done` and task_events held exactly ONE `completed` event. buildPlan marks
 * every already_done template done and completeOnboarding sets completed_at on
 * the insert — and nothing was written to task_events, so three of four
 * completions had no entry saying when or how they came to be closed.
 *
 * That matters because the trail is what "can this business prove compliance?"
 * rests on, and it is the hash-chained record. A status column asserting done
 * with nothing behind it is the shape the audit called out: a trail that is
 * incomplete and unattributed.
 *
 * There is also a consistency argument that only appeared once /catch-up
 * existed. That path writes `via: "catch-up"` for exactly the same act — the
 * owner saying work was already handled — so without this, one of the two ways
 * of pre-marking was traceable and the other was not.
 */
const actions = readFileSync(join(process.cwd(), "src/lib/actions.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

function body(fn: string): string {
  const at = actions.indexOf(`export async function ${fn}`);
  expect(at, `${fn} is gone`).toBeGreaterThan(-1);
  const next = actions.indexOf("export async function", at + 10);
  return actions.slice(at, next === -1 ? undefined : next);
}

describe("onboarding records what it pre-marks", () => {
  const onboarding = body("completeOnboarding");

  it("writes an event for every task it marks done", () => {
    expect(onboarding).toContain('kind: "completed"');
    expect(onboarding).toContain("plan.filter((t) => t.status === \"done\")");
  });

  it("writes nothing when nothing was pre-marked", () => {
    // A business that ticked none of the eighteen options should not produce
    // an empty insert.
    expect(onboarding).toContain("preMarked.length > 0");
  });

  it("says where the claim came from", () => {
    // The trail has to distinguish this from completeTask's flow, which
    // captured evidence at the time. This is the owner's recollection.
    expect(onboarding).toContain('via: "onboarding"');
  });

  it("records the transition, not just the end state", () => {
    expect(onboarding).toContain('from_status: "todo"');
    expect(onboarding).toContain('to_status: "done"');
  });
});

describe("the two pre-marking paths are traceable the same way", () => {
  it("catch-up marks its own origin too", () => {
    expect(body("applyCatchUp")).toContain('via: "catch-up"');
  });

  it("both use the completed kind for a completion", () => {
    // So a query for "how did this task come to be closed" finds either.
    expect(body("completeOnboarding")).toContain('kind: "completed"');
    expect(body("applyCatchUp")).toContain('mark === "done" ? "completed"');
  });

  it("neither claims the evidence flow's stronger provenance", () => {
    // completeTask captures documents and confirmations at the time; these two
    // are recollection, and the detail says so rather than being silent.
    for (const fn of ["completeOnboarding", "applyCatchUp"]) {
      expect(body(fn), `${fn} omits its origin`).toMatch(/via: "(onboarding|catch-up)"/);
    }
  });
});
