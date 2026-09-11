import { describe, expect, it } from "vitest";
import {
  countsTowardScore,
  dismissalOf,
  needsDismissalClarification,
  satisfiesDependency,
  scoreCreditFor,
  type DismissibleTask,
} from "./task-status";

const task = (over: Partial<DismissibleTask> = {}): DismissibleTask => ({
  status: "todo",
  is_relevant: true,
  dismissal: null,
  ...over,
});

describe("dismissalOf", () => {
  it("reads a legacy not_relevant row as not_applicable — the claim-least reading", () => {
    expect(dismissalOf(task({ status: "not_relevant", dismissal: null }))).toBe("not_applicable");
    expect(dismissalOf(task({ status: "not_relevant", dismissal: undefined }))).toBe(
      "not_applicable"
    );
  });

  it("is null for any status that is not a dismissal", () => {
    for (const status of ["todo", "in_progress", "waiting", "done"] as const) {
      expect(dismissalOf(task({ status }))).toBeNull();
    }
  });
});

describe("satisfiesDependency — the defect this module exists for", () => {
  it("a bare dismissal does NOT unlock a statutory duty", () => {
    // The original bug: an עוסק מורשה who dismissed "open a VAT file" as not
    // relevant thereby unlocked a real periodic VAT obligation, with penalties
    // attached, for a business that has no VAT file.
    const dismissed = task({ status: "not_relevant", dismissal: "not_applicable" });
    expect(satisfiesDependency(dismissed, { statutory: true })).toBe(false);
  });

  it("but it does unlock a recommendation, where 'not applicable' is a fine answer", () => {
    const dismissed = task({ status: "not_relevant", dismissal: "not_applicable" });
    expect(satisfiesDependency(dismissed, { statutory: false })).toBe(true);
  });

  it("handled_externally satisfies a statutory prerequisite — the duty is genuinely met", () => {
    const external = task({ status: "not_relevant", dismissal: "handled_externally" });
    expect(satisfiesDependency(external, { statutory: true })).toBe(true);
    expect(satisfiesDependency(external, { statutory: false })).toBe(true);
  });

  it("a legacy dismissal is treated as not_applicable, so it cannot keep a fabricated duty running", () => {
    const legacy = task({ status: "not_relevant", dismissal: null });
    expect(satisfiesDependency(legacy, { statutory: true })).toBe(false);
  });

  it("done always satisfies", () => {
    expect(satisfiesDependency(task({ status: "done" }), { statutory: true })).toBe(true);
  });

  it("an open task never satisfies", () => {
    for (const status of ["todo", "in_progress", "waiting"] as const) {
      expect(satisfiesDependency(task({ status }), { statutory: true })).toBe(false);
      expect(satisfiesDependency(task({ status }), { statutory: false })).toBe(false);
    }
  });

  it("a dependency absent from the plan is non-blocking — the alternative-prerequisite convention", () => {
    // vat-reporting depends on open-vat-file OR company-tax-files; whichever is
    // absent must not block. This is deliberate, and the reachability invariant
    // in content/invariants.test.ts is what stops it becoming "no gate at all".
    expect(satisfiesDependency(undefined, { statutory: true })).toBe(true);
  });

  it("a dependency whose rule no longer applies is non-blocking", () => {
    expect(satisfiesDependency(task({ is_relevant: false }), { statutory: true })).toBe(true);
  });
});

describe("score treatment", () => {
  it("not_applicable leaves the score entirely — numerator and denominator", () => {
    expect(countsTowardScore(task({ status: "not_relevant", dismissal: "not_applicable" }))).toBe(
      false
    );
  });

  it("handled_externally counts, at full credit", () => {
    const external = task({ status: "not_relevant", dismissal: "handled_externally" });
    expect(countsTowardScore(external)).toBe(true);
    expect(scoreCreditFor(external)).toBe(1);
  });

  it("done earns full credit, in_progress half, todo none", () => {
    expect(scoreCreditFor(task({ status: "done" }))).toBe(1);
    expect(scoreCreditFor(task({ status: "in_progress" }))).toBe(0.5);
    expect(scoreCreditFor(task({ status: "todo" }))).toBe(0);
    expect(scoreCreditFor(task({ status: "waiting" }))).toBe(0);
  });

  it("a task whose rule no longer applies is out of the score", () => {
    expect(countsTowardScore(task({ is_relevant: false }))).toBe(false);
  });

  it("cannot read 100 while a critical task is dismissed without explanation", () => {
    // The old computeScore excluded not_relevant from both sides, so dismissing
    // every open critical task read as 100% ready. That is still true for
    // not_applicable — correctly, since those rules do not apply — but the
    // dismissal is now flagged for clarification instead of silently scoring.
    const legacy = task({ status: "not_relevant", dismissal: null });
    expect(countsTowardScore(legacy)).toBe(false);
    expect(needsDismissalClarification(legacy)).toBe(true);
  });
});

describe("needsDismissalClarification", () => {
  it("flags only dismissals that never recorded which kind they were", () => {
    expect(needsDismissalClarification(task({ status: "not_relevant", dismissal: null }))).toBe(
      true
    );
    expect(
      needsDismissalClarification(task({ status: "not_relevant", dismissal: "not_applicable" }))
    ).toBe(false);
    expect(
      needsDismissalClarification(task({ status: "not_relevant", dismissal: "handled_externally" }))
    ).toBe(false);
    expect(needsDismissalClarification(task({ status: "todo" }))).toBe(false);
  });
});
