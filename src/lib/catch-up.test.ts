import { describe, expect, it } from "vitest";
import { ALREADY_DONE_OPTIONS, TEMPLATES_BY_ID } from "@/lib/content";
import {
  acceptableMarks,
  catchUpItems,
  commonlyDoneIds,
  looksLikeCatchUpNeeded,
  splitByLikelihood,
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

describe("noticing that a catch-up is probably needed", () => {
  /**
   * The questionnaire is linked from settings and /plan-ready, and neither is
   * somewhere people return to — so an owner who signed up months ago will
   * never find it. The product can usually tell, which makes staying quiet a
   * choice rather than a limitation.
   *
   * The signal is narrow on purpose, and what it REFUSES to use matters as
   * much as what it uses.
   */
  const needed = (stage: string | undefined, tasks: CatchUpTask[]) =>
    looksLikeCatchUpNeeded({ stage, tasks, templates: TEMPLATES_BY_ID });

  it("fires for an active business that has never closed anything", () => {
    // Trading, yet none of its own setup work recorded: far more likely the
    // work happened and was never entered.
    expect(needed("active", [task("open-vat-file"), task("choose-accountant")])).toBe(true);
  });

  it("stays quiet once anything has been closed", () => {
    // One close means the owner is engaging with the plan and keeping it
    // current; the product has no reason to doubt the picture.
    expect(
      needed("active", [task("open-vat-file", { status: "done" }), task("choose-accountant")])
    ).toBe(false);
  });

  it("counts a dismissal as engagement too", () => {
    // Saying "this does not apply to me" is also keeping the plan current.
    expect(
      needed("active", [
        task("open-vat-file", { status: "not_relevant" }),
        task("choose-accountant"),
      ])
    ).toBe(false);
  });

  it("never fires for a business that is still being set up", () => {
    // Having open setup tasks IS the normal state there, and that is the
    // product's whole purpose.
    expect(needed("setting_up", [task("open-vat-file")])).toBe(false);
    expect(needed("idea", [task("open-vat-file")])).toBe(false);
  });

  it("does not fire on a missing stage answer", () => {
    // An older row with no stage is not evidence of anything.
    expect(needed(undefined, [task("open-vat-file")])).toBe(false);
  });

  it("does not fire when the questionnaire would have nothing to offer", () => {
    // Only statutory filings open: those cannot be ticked there, so pointing
    // at an empty form would be worse than silence.
    expect(needed("active", [task("vat-reporting")])).toBe(false);
  });

  it("does not use 'many open tasks', which would fire for everyone", () => {
    // The distinguishing fact is zero closes, not volume. A new business has
    // many open tasks too, and nudging on that becomes wallpaper.
    const many = Array.from({ length: 30 }, () => task("choose-accountant"));
    expect(needed("setting_up", many)).toBe(false);
  });
});

describe("the nudge survives a reopened recurring task", () => {
  /**
   * A defect in my own heuristic, found by auditing it an hour after writing
   * it. projectCycles rewrites a reopened task to status "todo" AND
   * completed_at null — right for every screen asking "what is open now",
   * wrong for the only question this asks: has this owner EVER closed
   * anything.
   *
   * Fed the projected list, a business whose single closed task was a
   * recurring one that has since come round again reads as never having
   * engaged, and gets asked on every home visit despite keeping its plan
   * current. Home now passes the STORED tasks, and the predicate also accepts
   * a completion timestamp as proof of engagement, so it is right either way.
   */
  const needed = (tasks: CatchUpTask[]) =>
    looksLikeCatchUpNeeded({ stage: "active", tasks, templates: TEMPLATES_BY_ID });

  it("a completion timestamp counts, even with the status reopened", () => {
    // Exactly what projectCycles produces: todo, no completed_at... except the
    // stored row still has one, which is the fact that matters.
    expect(
      needed([
        task("choose-accountant", { status: "todo", completed_at: "2026-03-01T09:00:00Z" }),
        task("open-vat-file"),
      ])
    ).toBe(false);
  });

  it("still fires when nothing has ever been closed", () => {
    // The case above must not have disabled the nudge outright.
    expect(needed([task("choose-accountant"), task("open-vat-file")])).toBe(true);
  });

  it("treats a null timestamp as no engagement", () => {
    expect(needed([task("choose-accountant", { completed_at: null })])).toBe(true);
  });
});

describe("the list is ordered so it can be finished", () => {
  /**
   * Measured against the live data before building this: the two real
   * businesses would each be offered THIRTY-NINE and FORTY rows, two buttons
   * apiece — about eighty targets on one page. Grouping by category makes the
   * list read like the plan and does nothing about its length, and a
   * questionnaire nobody finishes collects nothing.
   *
   * The split reuses ALREADY_DONE_OPTIONS rather than inventing a ranking:
   * that list IS the curated answer to "what does a business usually already
   * have", written for this exact question at a different moment.
   */
  it("puts the commonly-handled rows in their own group", () => {
    const items = catchUpItems(
      [task("choose-accountant"), task("business-license"), task("buy-domain")],
      TEMPLATES_BY_ID
    );
    const common = commonlyDoneIds(ALREADY_DONE_OPTIONS, "osek_patur");
    const { likely, rest } = splitByLikelihood(items, common);
    expect(likely.map((i) => i.templateId).sort()).toEqual(["buy-domain", "choose-accountant"]);
    expect(rest.map((i) => i.templateId)).toEqual(["business-license"]);
  });

  it("hides nothing — every item lands in exactly one side", () => {
    // The point is ordering, not filtering. An item that fell out of both
    // would be a row the user could never answer.
    const items = catchUpItems(
      [task("choose-accountant"), task("business-license"), task("buy-domain")],
      TEMPLATES_BY_ID
    );
    const { likely, rest } = splitByLikelihood(items, commonlyDoneIds(ALREADY_DONE_OPTIONS, "osek_patur"));
    expect(likely.length + rest.length).toBe(items.length);
    expect(new Set([...likely, ...rest].map((i) => i.templateId)).size).toBe(items.length);
  });

  it("respects the entity gating on those options", () => {
    // A company is not offered the individual עוסק registration, which is the
    // same reason the onboarding step filters this list.
    const forCompany = commonlyDoneIds(ALREADY_DONE_OPTIONS, "company");
    const forIndividual = commonlyDoneIds(ALREADY_DONE_OPTIONS, "osek_patur");
    expect(forCompany.has("open-vat-file")).toBe(false);
    expect(forIndividual.has("open-vat-file")).toBe(true);
    expect(forCompany.has("register-company")).toBe(true);
  });

  it("keeps the ungated options for everyone", () => {
    // Options with no `entities` apply to every structure.
    for (const entity of ["osek_patur", "osek_murshe", "company", "partnership"]) {
      expect(commonlyDoneIds(ALREADY_DONE_OPTIONS, entity).has("invoicing-software")).toBe(true);
    }
  });

  it("offers only the ungated ones when the entity is unknown", () => {
    // An older row with no entity type must not be offered a registration
    // that may not apply to it.
    const unknown = commonlyDoneIds(ALREADY_DONE_OPTIONS, undefined);
    expect(unknown.has("invoicing-software")).toBe(true);
    expect(unknown.has("register-company")).toBe(false);
  });
});
