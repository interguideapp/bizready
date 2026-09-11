// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { positionOf } from "@/lib/content/milestones";
import { DEFAULT_COMPLETION } from "@/lib/types";
import { reviewAge } from "@/lib/staleness";
import type { TaskView } from "@/lib/task-view";

/**
 * The milestone tracker, verified as rendered output.
 *
 * These assert the things the user actually asked for, because each one was a
 * real complaint about the screen this replaced:
 *
 *  - the position is named per task, not "בתהליך";
 *  - you can see it without knowing to open a tab;
 *  - advancing is one tap and sends no form data;
 *  - the last tap still goes through the evidence flow.
 */
vi.mock("@/lib/actions", () => ({
  advanceStage: vi.fn(),
  revertStage: vi.fn(),
}));

const { advanceStage, revertStage } = await import("@/lib/actions");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function view(templateId: string, stage: string | null, over: Partial<TaskView> = {}): TaskView {
  const pos = positionOf({
    template_id: templateId,
    stage,
    status: over.status ?? "todo",
  });
  return {
    taskDbId: "task-1",
    templateId,
    archetype: "registration",
    title: "משימה",
    categoryTitle: "הקמה ורישום",
    categoryIcon: "Scale",
    priority: "critical",
    status: "todo",
    why: "כי צריך",
    steps: ["א", "ב"],
    stepsDone: [],
    pitfalls: [],
    afterSubmit: null,
    basis: "statutory",
    legalBasis: "statute",
    reviewAge: reviewAge("2026-09-03", "2026-09-12"),
    sourceUrl: null,
    dueDate: null,
    obligation: null,
    recurrence: null,
    milestones: {
      chain: pos.chain,
      currentId: pos.stage.id,
      step: pos.step,
      total: pos.total,
      nextLabel: pos.next?.owner === "done" ? null : (pos.next?.label ?? null),
      nextCompletes: pos.advanceCompletes,
      resolvedFromStage: pos.resolvedFromStage,
    },
    completion: DEFAULT_COMPLETION,
    completionData: {},
    completedAt: null,
    waitingFor: null,
    followUpDate: null,
    todayIso: "2026-09-12",
    personalDueDate: null,
    statutoryDueDate: null,
    docsNeeded: [],
    officialLinks: [],
    primaryLink: null,
    offers: [],
    unlocks: [],
    canEdit: true,
    readOnlyReason: null,
    guide: undefined,
    checklist: [],
    generatedDoc: null,
    isPro: true,
    ceiling: null,
    ...over,
  } as TaskView;
}

async function renderTracker(v: TaskView, onComplete = vi.fn()) {
  const { MilestoneTracker } = await import("./milestone-tracker");
  render(<MilestoneTracker view={v} onComplete={onComplete} />);
  return onComplete;
}

describe("the position is specific to the task", () => {
  it("names the milestone instead of saying 'בתהליך'", async () => {
    await renderTracker(view("open-vat-file", "awaiting_certificate", { status: "waiting" }));
    expect(screen.getByRole("heading", { name: "ממתין לתעודת עוסק" })).toBeDefined();
    expect(screen.queryByText("בתהליך")).toBeNull();
    expect(screen.queryByText(/גורם חיצוני/)).toBeNull();
  });

  it("says where in the task we are", async () => {
    await renderTracker(view("open-vat-file", "submit"));
    expect(screen.getByText(/שלב 2 מתוך 4/)).toBeDefined();
  });

  it("lists the whole chain, so the route is visible up front", async () => {
    // The user's complaint was not knowing what comes next. Every stage is on
    // screen, not just the current one.
    await renderTracker(view("open-vat-file", "prepare"));
    for (const label of [
      "אוספים מסמכים",
      "מוכן להגשה",
      "ממתין לתעודת עוסק",
      "התיק פתוח ויש מספר עוסק",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("distinguishes two waits inside one task", async () => {
    // A business licence waits for inspections, then for the licence. One
    // status could never tell those apart.
    await renderTracker(view("business-license", "awaiting_inspection", { status: "waiting" }));
    expect(
      screen.getByRole("heading", { name: "ממתין לביקורת ולאישורי גורמים" })
    ).toBeDefined();
  });
});

describe("advancing is one tap with no form", () => {
  it("is reachable immediately, with no tab to find first", async () => {
    // This is the discoverability complaint: the old control was three clicks
    // deep behind a tab called "לסגור".
    await renderTracker(view("open-vat-file", "prepare"));
    expect(screen.getByRole("button", { name: /המסמכים מוכנים/ })).toBeDefined();
  });

  it("sends only the stage it acted from — no status, reason or date", async () => {
    // The four things the user used to type are all derived on the server.
    await renderTracker(view("open-vat-file", "submit"));
    await userEvent.click(screen.getByRole("button", { name: /הגשתי את הבקשה/ }));
    expect(advanceStage).toHaveBeenCalledTimes(1);
    expect(advanceStage).toHaveBeenCalledWith("task-1", "submit");
  });

  it("labels the button with what the user did, not with a status", async () => {
    await renderTracker(view("open-vat-file", "submit"));
    expect(screen.queryByRole("button", { name: "ממתין" })).toBeNull();
    expect(screen.getByRole("button", { name: /הגשתי/ })).toBeDefined();
  });

  it("offers a way back for a misclick", async () => {
    await renderTracker(view("open-vat-file", "submit"));
    await userEvent.click(screen.getByRole("button", { name: /חזרה שלב אחד/ }));
    expect(revertStage).toHaveBeenCalledWith("task-1", "submit");
  });

  it("has nothing to go back to at the first stage", async () => {
    await renderTracker(view("open-vat-file", "prepare"));
    expect(screen.queryByRole("button", { name: /חזרה שלב אחד/ })).toBeNull();
  });
});

describe("a wait is described as a promise about us", () => {
  it("says when WE will remind, not when THEY will answer", async () => {
    // We cannot know the authority's timing, so the copy commits only to our
    // own reminder. Claiming an SLA would be inventing a fact.
    await renderTracker(
      view("open-vat-file", "awaiting_certificate", {
        status: "waiting",
        followUpDate: "2026-09-17",
      })
    );
    expect(screen.getByText(/נזכיר לכם לבדוק/)).toBeDefined();
  });
});

describe("the last milestone does not bypass the evidence trail", () => {
  it("hands the final tap to the completion flow", async () => {
    const chain = positionOf({ template_id: "open-vat-file", status: "todo" }).chain;
    const beforeLast = chain[chain.length - 2];
    const onComplete = await renderTracker(
      view("open-vat-file", beforeLast.id, { status: "waiting" })
    );
    await userEvent.click(screen.getByRole("button", { name: new RegExp(beforeLast.advance!) }));
    // Completion writes into the hash-chained audit log and copies the עוסק
    // number onto the business card. Advancing the stage would do neither.
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(advanceStage).not.toHaveBeenCalled();
  });

  it("shows a finished task as finished and offers a reopen", async () => {
    await renderTracker(view("open-vat-file", "registered", { status: "done" }));
    expect(screen.getByText("המשימה הושלמה")).toBeDefined();
    expect(screen.getByRole("button", { name: /פתיחה מחדש/ })).toBeDefined();
  });
});

describe("a viewer and a legacy row", () => {
  it("gives a viewer no button, and says why", async () => {
    await renderTracker(
      view("open-vat-file", "submit", {
        canEdit: false,
        readOnlyReason: "יש לכם גישת צפייה לתיק הזה.",
      })
    );
    expect(screen.queryByRole("button", { name: /הגשתי/ })).toBeNull();
    expect(screen.getByText(/גישת צפייה/)).toBeDefined();
  });

  it("admits when the position was reconstructed from the old status", async () => {
    // Every task that existed before this feature has no stage. Saying so is
    // better than presenting a guess as a measurement.
    await renderTracker(view("open-vat-file", null, { status: "waiting" }));
    expect(screen.getByText(/מבוסס על הסטטוס הקודם/)).toBeDefined();
  });

  it("says nothing of the sort once a real stage is stored", async () => {
    await renderTracker(view("open-vat-file", "submit"));
    expect(screen.queryByText(/מבוסס על הסטטוס הקודם/)).toBeNull();
  });
});
