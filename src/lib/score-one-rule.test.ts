import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeScore } from "@/lib/rules-engine";
import { scoreCreditFor, type DismissibleTask } from "@/lib/task-status";
import type { TaskTemplate } from "@/lib/types";

/**
 * ONE DEFINITION OF WHAT A TASK EARNS.
 *
 * scoreCreditFor was exported, documented as "the fraction of credit a task
 * earns in the score", and tested — and called by nothing. computeScore
 * inlined its own copy, and the two disagreed about "waiting": the named
 * helper gave none, the shipped expression gives half, and the test asserted
 * the none. So a tested value contradicted the rendered value on the
 * readiness score, and anyone reaching for the obvious helper would have got
 * the wrong answer.
 *
 * Resolved toward what ships, deliberately: removing a duplicate must not move
 * anybody's score. A task handed to an accountant is out of the user's hands
 * and is real progress, which is the reading computeScore's own comment gives.
 *
 * Third time this shape has appeared here — STATUTORY_FILINGS and
 * ConfidenceState were both declared twice — so the agreement is asserted
 * rather than trusted.
 */
const template = (over: Partial<TaskTemplate> = {}): TaskTemplate =>
  ({
    id: "t1",
    category_id: "tax",
    title: "t",
    priority: "critical",
    depends_on: [],
    applies_when: {},
    ...over,
  }) as TaskTemplate;

const templates = new Map([["t1", template()]]);

/** The score computeScore gives a single task, as a fraction of its weight. */
function fractionFor(task: Partial<DismissibleTask> & { status: string }): number {
  const score = computeScore(
    [
      {
        template_id: "t1",
        status: task.status,
        is_relevant: task.is_relevant ?? true,
        dismissal: task.dismissal ?? null,
      } as never,
    ],
    templates
  );
  return score.overall / 100;
}

describe("the engine and the named helper agree, for every status", () => {
  const STATUSES = ["todo", "in_progress", "waiting", "done"] as const;

  it("the premise: these statuses really do produce different scores", () => {
    // Without this, agreement could be the agreement of two constants.
    const seen = new Set(STATUSES.map((status) => fractionFor({ status })));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("gives each status exactly the credit the helper says", () => {
    for (const status of STATUSES) {
      const task: DismissibleTask = { status, is_relevant: true, dismissal: null } as never;
      expect(fractionFor({ status }), status).toBeCloseTo(scoreCreditFor(task), 5);
    }
  });

  it("agrees about a duty handled outside the product", () => {
    // handled_externally earns full credit in both, which is the whole point
    // of splitting it from not_applicable.
    const task: DismissibleTask = {
      status: "not_relevant",
      is_relevant: true,
      dismissal: "handled_externally",
    } as never;
    expect(fractionFor({ status: "not_relevant", dismissal: "handled_externally" })).toBeCloseTo(
      scoreCreditFor(task),
      5
    );
  });

  it("waiting still earns half, so no existing score moved", () => {
    // Named explicitly: this is the value that was already rendered, and the
    // consolidation must not have changed it.
    expect(fractionFor({ status: "waiting" })).toBeCloseTo(0.5, 5);
  });
});

describe("the engine does not keep its own copy of the rule", () => {
  it("calls the helper instead of re-deriving the credit", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/rules-engine.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(src).toContain("scoreCreditFor(task)");
    // The shape of the inlined copy: a ternary on status deciding 1 / 0.5 / 0.
    expect(src).not.toMatch(/task\.status === "in_progress" \|\| task\.status === "waiting"/);
  });
});
