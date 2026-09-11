// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskView } from "@/lib/task-view";
import { DEFAULT_COMPLETION } from "@/lib/types";
import { reviewAge } from "@/lib/staleness";

/**
 * The task screen, verified as rendered output.
 *
 * This screen is behind a login, so the browser pane could never reach it —
 * which left the two most consequential claims about it unverified against
 * anything but source code: that a viewer is not offered controls whose writes
 * the database will reject, and that the provenance of a legal claim is
 * actually on screen.
 *
 * Server actions are stubbed because importing them would pull in the Supabase
 * server client and `next/headers`, neither of which exists outside a request.
 * The stubs are never called — every test here is about what renders.
 */
// The back link reads the router and the query string, neither of which
// exists outside a Next request. Mocked at the module boundary rather than
// wrapped in a provider, because the component under test here is the task
// screen, not the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/tasks/open-vat-file",
}));

vi.mock("@/lib/actions", () => ({
  setTaskStatus: vi.fn(),
  saveTaskNotes: vi.fn(),
  completeTask: vi.fn(),
  toggleTaskStep: vi.fn(),
  addDocument: vi.fn(),
  toggleChecklistItem: vi.fn(),
  setTaskDueDate: vi.fn(),
  trackOfferClick: vi.fn(),
}));

afterEach(cleanup);

function view(over: Partial<TaskView> = {}): TaskView {
  return {
    taskDbId: "task-1",
    templateId: "open-vat-file",
    archetype: "registration",
    title: 'פתיחת תיק עוסק במע"מ',
    categoryTitle: "הקמה ורישום",
    categoryIcon: "Scale",
    priority: "critical",
    status: "todo",
    why: "בלי תיק במע\"מ אסור להתחיל לפעול",
    steps: ["שלב ראשון", "שלב שני"],
    stepsDone: [],
    pitfalls: [],
    afterSubmit: null,
    basis: "statutory",
    legalBasis: "statute",
    reviewAge: reviewAge("2026-09-03", "2026-09-11"),
    sourceUrl: "https://www.gov.il/he/service/vat-821",
    dueDate: "2026-10-15",
    obligation: null,
    recurrence: null,
    completion: DEFAULT_COMPLETION,
    completionData: {},
    completedAt: null,
    waitingFor: null,
    followUpDate: null,
    docsNeeded: [],
    officialLinks: [{ label: "רשות המסים", url: "https://www.gov.il/he/service/vat-821" }],
    primaryLink: { label: "רשות המסים", url: "https://www.gov.il/he/service/vat-821" },
    offers: [],
    checklist: [],
    notes: "",
    pro: false,
    canEdit: true,
    readOnlyReason: null,
    businessName: "עסק לדוגמה",
    dealerNumber: null,
    unlocks: [],
    generator: null,
    generatedDoc: null,
    ceiling: null,
    ...over,
  };
}

async function renderTask(over: Partial<TaskView> = {}) {
  const { TaskExperience } = await import("./task-experience");
  return render(
    <TaskExperience view={view(over)} attachedDocs={[]} docCategory="registration" />
  );
}

/**
 * The status controls live in the "לסגור" phase, so the tests that care about
 * them open that tab first — the same three clicks a user makes.
 */
async function openFinishPhase() {
  await userEvent.click(screen.getByRole("button", { name: "לסגור" }));
}

describe("a viewer is not offered controls that would be rejected", () => {
  it("hides the status picker and explains why", async () => {
    await renderTask({
      canEdit: false,
      readOnlyReason: "יש לכם גישת צפייה לתיק הזה.",
    });
    await openFinishPhase();
    // The status buttons come from StatusPicker, inside a group with this name.
    expect(screen.queryByRole("group", { name: "סטטוס המשימה" })).toBeNull();
    expect(screen.getByText(/גישת צפייה/)).toBeDefined();
  });

  it("hides the notes editor, which is also a write", async () => {
    await renderTask({ canEdit: false, readOnlyReason: "גישת צפייה" });
    expect(screen.queryByText("הערות שלי")).toBeNull();
  });

  it("but an owner gets both", async () => {
    await renderTask({ canEdit: true });
    await openFinishPhase();
    expect(screen.getByRole("group", { name: "סטטוס המשימה" })).toBeDefined();
    expect(screen.getByText("הערות שלי")).toBeDefined();
  });

  it("and a viewer cannot tick a step either", async () => {
    // Ticking is a write. Without this the viewer clicks, sees the optimistic
    // update land, then watches it revert when RLS rejects it.
    await renderTask({ canEdit: false, readOnlyReason: "גישת צפייה" });
    await userEvent.click(screen.getByRole("button", { name: "לפעול" }));
    const stepButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("שלב ראשון"));
    expect(stepButtons.length).toBeGreaterThan(0);
    expect(stepButtons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe("the provenance of a legal claim is actually on screen", () => {
  it("names the basis, so 'critical' is explainable", async () => {
    await renderTask({ legalBasis: "statute" });
    // Appears twice by design: the hero chip and the provenance card.
    expect(screen.getAllByText("חובה על פי חוק").length).toBeGreaterThan(0);
  });

  it("shows when the content was last checked, and links the source", async () => {
    await renderTask();
    expect(screen.getByText(/נבדק מול המקור/)).toBeDefined();
    const source = screen.getByRole("link", { name: /המקור שהמידע נכתב לפיו/ });
    expect(source.getAttribute("href")).toBe("https://www.gov.il/he/service/vat-821");
  });

  it("warns when the review has gone stale", async () => {
    // last_reviewed more than a year before "today".
    await renderTask({ reviewAge: reviewAge("2025-01-01", "2026-09-11") });
    expect(screen.getByText(/לא נבדק מול המקור הרשמי מעל שנה/)).toBeDefined();
  });

  it("says nothing about staleness when the content is fresh", async () => {
    await renderTask({ reviewAge: reviewAge("2026-09-03", "2026-09-11") });
    expect(screen.queryByText(/מעל שנה/)).toBeNull();
  });

  it("carries a disclaimer on the page that states the figures", async () => {
    // The shared Disclaimer rendered on only two other pages, and never on the
    // one quoting corporate tax rates and statutory compensation amounts.
    await renderTask();
    expect(screen.getByText(/לא ייעוץ משפטי/)).toBeDefined();
  });

  it("does not claim the law requires something it only recommends", async () => {
    await renderTask({ legalBasis: "commercial" });
    expect(screen.queryByText("חובה על פי חוק")).toBeNull();
    expect(screen.getAllByText("בחירה עסקית").length).toBeGreaterThan(0);
  });
});
