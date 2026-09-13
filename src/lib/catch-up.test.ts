import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  acceptableMarks,
  catchUpItems,
  statutoryHeldBack,
  type CatchUpTask,
} from "@/lib/catch-up";

/**
 * The catch-up questionnaire, and the one thing it must never let through.
 *
 * Onboarding asks "what do you already have" once, and `already_done` is read
 * exactly once after that: at plan-build time. So a business that existed
 * before signing up, or an owner who got a lot done offline, had no way to tell
 * the product except task by task — while the readiness score, the exposure
 * ranking and every alert were computed from a picture known to be stale.
 *
 * THE SAFETY PROPERTY: a statutory filing may never be ticked here. The audit
 * was explicit — "never allow a client to set a statutory filing done without
 * the evidence flow" — because marking vat-reporting done silences the overdue
 * alarm, earns the "מדווחים בזמן" badge and makes the penalty-bearing reminder
 * path unreachable, for a filing nobody made.
 */
const task = (template_id: string, over: Partial<CatchUpTask> = {}): CatchUpTask => ({
  template_id,
  status: "todo",
  is_relevant: true,
  ...over,
});

const STATUTORY = ["vat-reporting", "income-tax-advances", "annual-tax-report"];

describe("statutory filings are never offered", () => {
  it("excludes every one of them", () => {
    const items = catchUpItems(
      STATUTORY.map((id) => task(id)),
      TEMPLATES_BY_ID
    );
    expect(items).toEqual([]);
  });

  it("lists them separately, so a screen can say why they are absent", () => {
    // Silently omitting them would read as "these do not apply to you", which
    // is the opposite of true.
    const held = statutoryHeldBack(
      STATUTORY.map((id) => task(id)),
      TEMPLATES_BY_ID
    );
    expect(held.map((h) => h.templateId).sort()).toEqual([...STATUTORY].sort());
  });

  it("refuses them even when the browser submits them anyway", () => {
    // A Server Action is a public POST endpoint; the ids arrive from a client.
    const marks = acceptableMarks(
      STATUTORY.map((id) => ({ templateId: id, mark: "done" as const })),
      STATUTORY.map((id) => task(id)),
      TEMPLATES_BY_ID
    );
    expect(marks).toEqual([]);
  });

  it("refuses them under the other mark too", () => {
    // handled_externally SATISFIES a dependency, so it is the more dangerous
    // of the two for a filing: it would open the duties gated behind it.
    const marks = acceptableMarks(
      [{ templateId: "vat-reporting", mark: "handled_externally" }],
      [task("vat-reporting")],
      TEMPLATES_BY_ID
    );
    expect(marks).toEqual([]);
  });
});

describe("what it does offer", () => {
  it("offers open, relevant setup work", () => {
    const items = catchUpItems(
      [task("open-vat-file"), task("choose-accountant")],
      TEMPLATES_BY_ID
    );
    expect(items.map((i) => i.templateId)).toEqual(["open-vat-file", "choose-accountant"]);
  });

  it("skips what is already done, since it needs no catching up", () => {
    const items = catchUpItems([task("choose-accountant", { status: "done" })], TEMPLATES_BY_ID);
    expect(items).toEqual([]);
  });

  it("skips what the user dismissed, rather than quietly reversing it", () => {
    // Dismissing a task was a deliberate decision with its own reason
    // recorded; re-offering it here would invite undoing it by accident.
    const items = catchUpItems(
      [task("choose-accountant", { status: "not_relevant" })],
      TEMPLATES_BY_ID
    );
    expect(items).toEqual([]);
  });

  it("skips what is no longer in the plan", () => {
    const items = catchUpItems(
      [task("choose-accountant", { is_relevant: false })],
      TEMPLATES_BY_ID
    );
    expect(items).toEqual([]);
  });

  it("carries the title and category, so the list can be grouped", () => {
    const [item] = catchUpItems([task("choose-accountant")], TEMPLATES_BY_ID);
    expect(item.title).toBeTruthy();
    expect(item.categoryId).toBeTruthy();
  });

  it("ignores an id with no template rather than throwing", () => {
    expect(catchUpItems([task("no-such-template")], TEMPLATES_BY_ID)).toEqual([]);
  });
});

describe("what the server will accept", () => {
  const plan = [task("open-vat-file"), task("choose-accountant")];

  it("accepts both marks on an offered task", () => {
    const marks = acceptableMarks(
      [
        { templateId: "open-vat-file", mark: "done" },
        { templateId: "choose-accountant", mark: "handled_externally" },
      ],
      plan,
      TEMPLATES_BY_ID
    );
    expect(marks).toHaveLength(2);
  });

  it("drops a task that is not in this business's plan", () => {
    expect(
      acceptableMarks(
        [{ templateId: "register-company", mark: "done" }],
        plan,
        TEMPLATES_BY_ID
      )
    ).toEqual([]);
  });

  it("drops an invented mark", () => {
    const marks = acceptableMarks(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [{ templateId: "open-vat-file", mark: "deleted" as any }],
      plan,
      TEMPLATES_BY_ID
    );
    expect(marks).toEqual([]);
  });

  it("keeps one decision per task, first wins", () => {
    // A duplicated id must not produce two conflicting writes in one
    // submission.
    const marks = acceptableMarks(
      [
        { templateId: "open-vat-file", mark: "done" },
        { templateId: "open-vat-file", mark: "handled_externally" },
      ],
      plan,
      TEMPLATES_BY_ID
    );
    expect(marks).toEqual([{ templateId: "open-vat-file", mark: "done" }]);
  });

  it("drops the unofferable without failing the whole submission", () => {
    // A plan that changed in another tab must not lose the user's other answers.
    const marks = acceptableMarks(
      [
        { templateId: "vat-reporting", mark: "done" },
        { templateId: "choose-accountant", mark: "done" },
      ],
      [...plan, task("vat-reporting")],
      TEMPLATES_BY_ID
    );
    expect(marks).toEqual([{ templateId: "choose-accountant", mark: "done" }]);
  });
});
