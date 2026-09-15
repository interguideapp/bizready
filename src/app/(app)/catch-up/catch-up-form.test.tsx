// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatchUpForm } from "./catch-up-form";

/**
 * ASKING FOR THE ARTEFACT AT THE MOMENT THE CLAIM IS MADE.
 *
 * This pass closed tasks and recorded nothing, exactly as the registration
 * wizard's "מה כבר יש?" did — so a business that caught its plan up showed a
 * wall of completed work and a certificate with nothing on it. The field has
 * to appear when a row is marked "עשיתי" and not before, has to disappear when
 * the row is cleared, and must never appear for "מטופל בחוץ", which is not a
 * completion at all.
 */
const applyCatchUp = vi.fn((_marks: unknown, _evidence: unknown) => Promise.resolve({ done: 1, handled: 0, refused: 0, attempted: 1 }));
vi.mock("@/lib/actions", () => ({
  applyCatchUp: (marks: unknown, evidence: unknown) => applyCatchUp(marks, evidence),
}));
vi.mock("@/components/toaster", () => ({
  toast: Object.assign(
    () => {},
    { success: () => {}, error: () => {} }
  ),
}));

afterEach(() => {
  cleanup();
  applyCatchUp.mockClear();
});

/** open-vat-file asks for the dealer number first, and it is required. */
const groups = [
  {
    categoryId: "tax",
    title: "מיסים",
    items: [
      { templateId: "open-vat-file", title: "פתיחת תיק עוסק במע״מ", priority: "critical" },
      { templateId: "buy-domain", title: "רכישת דומיין", priority: "recommended" },
    ] as never,
  },
];

const done = () => screen.getAllByRole("button", { name: /עשיתי/ })[0];
const external = () => screen.getAllByRole("button", { name: /מטופל בחוץ/ })[0];
const artefact = () => screen.queryByLabelText(/מספר העוסק/);

describe("the artefact field", () => {
  it("is not there until the row is marked done", async () => {
    render(<CatchUpForm groups={groups} />);
    expect(artefact()).toBeNull();
    await userEvent.click(done());
    expect(artefact()).toBeTruthy();
  });

  it("never appears for מטופל בחוץ, which is not a completion", async () => {
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(external());
    expect(artefact()).toBeNull();
  });

  it("goes away when the row is cleared", async () => {
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(done());
    expect(artefact()).toBeTruthy();
    // Clicking the same answer again clears the row.
    await userEvent.click(done());
    expect(artefact()).toBeNull();
  });

  it("asks for the label the template asks for, not a generic note", async () => {
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(done());
    expect(screen.getByText(/מספר העוסק/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("dealer_number");
  });
});

describe("what reaches the server", () => {
  it("sends the answer keyed by template id", async () => {
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(done());
    await userEvent.type(artefact()!, "123456789");
    await userEvent.click(screen.getByRole("button", { name: /עדכון התכנית/ }));

    expect(applyCatchUp).toHaveBeenCalledWith(
      [{ templateId: "open-vat-file", mark: "done" }],
      { "open-vat-file": "123456789" }
    );
  });

  it("sends no answer for a row switched to מטופל בחוץ after being typed into", async () => {
    // The dangerous shape: evidence left behind for a row that is no longer a
    // completion would be a recorded detail about work the product does not
    // believe was done — and on the certificate it would read as proof.
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(done());
    await userEvent.type(artefact()!, "123456789");
    await userEvent.click(external());
    await userEvent.click(screen.getByRole("button", { name: /עדכון התכנית/ }));

    expect(applyCatchUp).toHaveBeenCalledWith(
      [{ templateId: "open-vat-file", mark: "handled_externally" }],
      {}
    );
  });

  it("still submits when nothing was typed, since the answer is optional", async () => {
    render(<CatchUpForm groups={groups} />);
    await userEvent.click(done());
    await userEvent.click(screen.getByRole("button", { name: /עדכון התכנית/ }));
    expect(applyCatchUp).toHaveBeenCalledWith(
      [{ templateId: "open-vat-file", mark: "done" }],
      {}
    );
  });
});
