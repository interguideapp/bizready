// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Clearing a missed period.
 *
 * The board can name every unfiled period. Without this control it could only
 * name them — so the product would report a debt it gave no way to settle, and
 * an alarm with no off switch makes people distrust the whole surface rather
 * than the item.
 */
vi.mock("@/lib/actions", () => ({ markPeriodFiled: vi.fn() }));
const { markPeriodFiled } = await import("@/lib/actions");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function renderControl() {
  const { MarkPeriodFiled } = await import("./mark-period-filed");
  render(
    <MarkPeriodFiled
      templateId="vat-reporting"
      periodKey="2026-07..2026-08"
      periodLabel="יולי–אוגוסט 2026"
    />
  );
}

describe("marking a period filed", () => {
  it("does not act on the first tap", async () => {
    // Claiming a statutory filing was submitted is a statement of fact that
    // goes into the record. It should not be one mis-tap away on a list row.
    await renderControl();
    await userEvent.click(screen.getByRole("button", { name: /כבר הגשתי/ }));
    expect(markPeriodFiled).not.toHaveBeenCalled();
  });

  it("names the period in the confirmation, so the right one is cleared", async () => {
    await renderControl();
    await userEvent.click(screen.getByRole("button", { name: /כבר הגשתי/ }));
    expect(screen.getByText(/לסמן יולי–אוגוסט 2026 כמוגש/)).toBeDefined();
  });

  it("sends the period key, not the label", async () => {
    await renderControl();
    await userEvent.click(screen.getByRole("button", { name: /כבר הגשתי/ }));
    await userEvent.click(screen.getByRole("button", { name: "כן" }));
    expect(markPeriodFiled).toHaveBeenCalledWith("vat-reporting", "2026-07..2026-08");
  });

  it("can be backed out of", async () => {
    await renderControl();
    await userEvent.click(screen.getByRole("button", { name: /כבר הגשתי/ }));
    await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
    expect(markPeriodFiled).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /כבר הגשתי/ })).toBeDefined();
  });

  it("says so when the write fails, instead of looking like it worked", async () => {
    vi.mocked(markPeriodFiled).mockRejectedValueOnce(new Error("nope"));
    await renderControl();
    await userEvent.click(screen.getByRole("button", { name: /כבר הגשתי/ }));
    await userEvent.click(screen.getByRole("button", { name: "כן" }));
    expect(await screen.findByRole("alert")).toBeDefined();
  });
});
