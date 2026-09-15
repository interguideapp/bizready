// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./wizard";

/**
 * THE REGISTRATION FLOW'S LAST STEP, WHICH COLLECTED NOTHING.
 *
 * "מה כבר יש?" closes every task the owner ticks. All 17 options close a task
 * whose spec declares a required answer, and 13 of them declare a `writesTo`
 * that fills a business-card column — and none of it was ever asked for. So a
 * brand-new user who truthfully ticked "פתחתי תיק עוסק במע״מ" reached a card
 * where the task read done, מספר עוסק was empty, "מה חסר ל-100%?" said the
 * number was missing, and the certificate said the task had been completed
 * with nothing recorded.
 *
 * This walks the real wizard to that step, because the defect was never in a
 * function — it was in a screen that did not ask.
 */
const completeOnboarding = vi.fn();
vi.mock("@/lib/actions", () => ({
  completeOnboarding: (...a: unknown[]) => {
    completeOnboarding(...a);
  },
}));

afterEach(() => {
  cleanup();
  completeOnboarding.mockClear();
});

const SKIP = /המשך|חזרה|לא בטוחים/;

/**
 * Walk the REAL wizard to "מה כבר יש?", answering each step on the way.
 *
 * Answers every choice on a step rather than just the first, because two
 * steps ask more than one question — "איך אתם מוכרים ולמי?" needs a channel
 * AND a client type, and "details" is six yes/no rows. A walker that clicked
 * only the first choice sat on the channels step forever.
 */
async function reachAlreadyStep(user: ReturnType<typeof userEvent.setup>) {
  render(<OnboardingWizard />);
  await user.type(screen.getByRole("textbox"), "העסק שלי");

  for (let pass = 0; pass < 30; pass++) {
    if (screen.queryByText("פתחתי תיק עוסק במע״מ")) return;

    const advance = screen.queryByRole("button", { name: /המשך/ });
    if (advance && !advance.hasAttribute("disabled")) {
      await user.click(advance);
      continue;
    }

    const count = screen.getAllByRole("button").filter((b) => !SKIP.test(b.textContent ?? "")).length;
    if (count === 0) break;
    for (let i = 0; i < count; i++) {
      const choices = screen
        .getAllByRole("button")
        .filter((b) => !SKIP.test(b.textContent ?? ""));
      if (i < choices.length) await user.click(choices[i]);
    }
  }
  throw new Error("never reached the מה כבר יש step");
}

/**
 * THE WIZARD DID NOT RENDER AT ALL, AND NOTHING NOTICED FOR FOUR DAYS.
 *
 * `isVisible` was a `const` arrow declared BELOW the useMemo that calls it.
 * A useMemo factory runs during the same render, so the call hit the temporal
 * dead zone: `ReferenceError: Cannot access 'isVisible' before
 * initialization`, on the first render, for every signup — shipped
 * 2026-09-11 in a commit titled "a funnel that cannot dead-end".
 *
 * TypeScript does not track the dead zone across a closure, so `tsc` was
 * clean; the production build compiled; 1,665 tests passed. Not one of them
 * rendered a page-level component, which is the only check that could see it.
 * Both businesses in the live database registered before that date.
 *
 * This test exists so the registration screen can never again be broken
 * silently, and every test below it depends on the same render.
 */
describe("the screen renders at all", () => {
  it("mounts without throwing", () => {
    expect(() => render(<OnboardingWizard />)).not.toThrow();
  });

  it("shows the first question", () => {
    render(<OnboardingWizard />);
    expect(screen.getByText("איך קוראים לעסק?")).toBeTruthy();
  });
});

describe("the step that asserts work is already done", () => {
  it("asks for nothing until a box is ticked", async () => {
    const user = userEvent.setup();
    await reachAlreadyStep(user);
    expect(screen.queryByText(/מספר העוסק/)).toBeNull();
  });

  it("asks for that task's own artefact once it is ticked", async () => {
    const user = userEvent.setup();
    await reachAlreadyStep(user);
    await user.click(screen.getByText("פתחתי תיק עוסק במע״מ"));
    // The label the template asks for, never the column name.
    expect(screen.getByText(/מספר העוסק/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("dealer_number");
  });

  it("says the answer is optional, so registration cannot dead-end on it", async () => {
    const user = userEvent.setup();
    await reachAlreadyStep(user);
    await user.click(screen.getByText("פתחתי תיק עוסק במע״מ"));
    expect(document.body.textContent).toContain("לא חייב");
    // And the step is still passable with the field left empty: it is the
    // last one, so its button offers to build the plan.
    const build = screen.getByRole("button", { name: /בנו לי את התכנית/ });
    expect(build.hasAttribute("disabled")).toBe(false);
  });

  it("drops the answer when the box is unticked", async () => {
    const user = userEvent.setup();
    await reachAlreadyStep(user);
    const box = screen.getByText("פתחתי תיק עוסק במע״מ");
    await user.click(box);
    await user.type(screen.getByRole("textbox", { name: /מספר העוסק/ }), "123456789");
    await user.click(box);
    expect(screen.queryByText(/מספר העוסק/)).toBeNull();

    // And ticking it again starts empty rather than resurrecting the old
    // answer, which would attach a number to a claim just re-made.
    await user.click(box);
    expect((screen.getByRole("textbox", { name: /מספר העוסק/ }) as HTMLInputElement).value).toBe("");
  });
});
