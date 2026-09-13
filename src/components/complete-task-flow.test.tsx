// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Closing a recurring task for the SECOND time.
 *
 * completeTask merges completion_data, so evidence survives. The cost was that
 * a renewal date typed a year ago stayed in the database while this form opened
 * empty — so re-closing the task kept the old expiry, and every engine read it
 * as the current one. The product then insisted the cover had lapsed, the day
 * after the user renewed it, with no way to clear the alarm.
 *
 * openRenewalOf stops the false alarm. These two behaviours are what keep the
 * tracking ACCURATE rather than merely quiet: show the person the stale date,
 * and refuse an expiry that has already passed.
 */
vi.mock("@/lib/actions", () => ({ completeTask: vi.fn() }));
vi.mock("@/components/toaster", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));
const { completeTask } = await import("@/lib/actions");
const { CompleteTaskFlow } = await import("./complete-task-flow");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const completion = {
  confirm: "אני מאשר שהפוליסה בתוקף",
  fields: [{ key: "renewal", label: "תאריך חידוש הפוליסה", type: "date" as const }],
};

/** The renewal input, by its label. */
function field(): HTMLInputElement {
  return screen.getByLabelText(/תאריך חידוש/) as HTMLInputElement;
}

function renderFlow(previous?: Record<string, string> | null) {
  return render(
    <CompleteTaskFlow
      taskId="t1"
      steps={["רכשו פוליסה"]}
      completion={completion}
      previous={previous}
      onCancel={() => {}}
    />
  );
}

/** Tick the step and the confirmation, which is all that gates submission. */
async function satisfyTheRest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("רכשו פוליסה"));
  await user.click(screen.getByText(completion.confirm));
}

describe("the previous period's evidence is put in front of the user", () => {
  it("prefills the renewal date from the last close", () => {
    renderFlow({ renewal: "2026-03-10" });
    expect(field().value).toBe("2026-03-10");
  });

  it("opens empty on a first close", () => {
    renderFlow(null);
    expect(field().value).toBe("");
  });
});

describe("an expiry that has already passed is refused", () => {
  it("says why, instead of just disabling the button", async () => {
    const user = userEvent.setup();
    renderFlow({ renewal: "2026-03-10" });
    await satisfyTheRest(user);
    expect(screen.getByRole("alert").textContent).toMatch(/כבר עבר/);
    // Clicked for real: asserting not-called without pressing the button made
    // this pass even with the condition removed from canSubmit.
    await user.click(screen.getByRole("button", { name: /סיימתי את המשימה/ }));
    expect(completeTask).not.toHaveBeenCalled();
  });

  it("names the real blocker rather than the last one in the chain", async () => {
    // The hint under the button is a ternary chain that was exhaustive over the
    // three original conditions. With everything else satisfied it would have
    // said "confirm the declaration" to someone who just had.
    const user = userEvent.setup();
    renderFlow({ renewal: "2026-03-10" });
    await satisfyTheRest(user);
    expect(screen.getByText("עדכנו את תאריך התוקף")).toBeDefined();
  });

  it("marks the field itself as the invalid one", () => {
    renderFlow({ renewal: "2026-03-10" });
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("accepts the close once a future expiry is given", async () => {
    const user = userEvent.setup();
    renderFlow({ renewal: "2026-03-10" });
    await user.clear(field());
    await user.type(field(), "2027-03-10");
    await satisfyTheRest(user);
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: /סיימתי את המשימה/ }));
    expect(completeTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ renewal: "2027-03-10" }),
      expect.anything()
    );
  });
});
