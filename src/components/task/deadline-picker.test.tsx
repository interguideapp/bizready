// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The deadline picker, verified as rendered output.
 *
 * The point of this panel is that the user never does date arithmetic and never
 * has to already know a legal deadline in order to work with it. These assert
 * both, plus the two guardrails: a date the product asserts on the law's behalf
 * carries its source, and a target set after the legal deadline says so.
 */
vi.mock("@/lib/actions", () => ({ setTaskDueDate: vi.fn() }));

const { setTaskDueDate } = await import("@/lib/actions");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function renderPicker(over: Partial<Parameters<typeof import("./deadline-picker").DeadlinePicker>[0]> = {}) {
  const { DeadlinePicker } = await import("./deadline-picker");
  const onDone = vi.fn();
  render(
    <DeadlinePicker
      taskId="task-1"
      templateId="vat-reporting"
      todayIso="2026-09-12"
      personalDueDate={null}
      statutoryDueDate="2026-11-15"
      onDone={onDone}
      {...over}
    />
  );
  return onDone;
}

describe("the legal date is stated before any preference", () => {
  it("says what the law requires and that it does not move", async () => {
    await renderPicker();
    expect(screen.getByText(/המועד החוקי לדיווח הזה הוא/)).toBeDefined();
    expect(screen.getAllByText("15.11.2026").length).toBeGreaterThan(0);
  });

  it("offers the legal date as a one-tap choice, with a source to check it", async () => {
    await renderPicker();
    const chip = screen.getByRole("button", { name: /^המועד החוקי/ });
    expect(chip).toBeDefined();
    // A date asserted on the law's behalf has to be checkable.
    const source = screen.getByRole("link", { name: /מקור/ });
    expect(source.getAttribute("href")).toMatch(/^https:\/\//);
  });

  it("says nothing about a legal date for a task that has none", async () => {
    await renderPicker({ templateId: "buy-domain", statutoryDueDate: null });
    expect(screen.queryByText(/המועד החוקי לדיווח/)).toBeNull();
    // The relative picks are still there — every task can have a target.
    expect(screen.getByRole("button", { name: /^בעוד שבוע\s/ })).toBeDefined();
  });
});

describe("no arithmetic asked of the user", () => {
  it("resolves the relative options to real dates on the chip", async () => {
    await renderPicker();
    expect(screen.getByRole("button", { name: /בעוד שבוע.*19\.9\.2026/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /בעוד שבועיים.*26\.9\.2026/ })).toBeDefined();
  });

  it("saves the date behind the chip that was tapped", async () => {
    await renderPicker();
    await userEvent.click(screen.getByRole("button", { name: /^בעוד שבועיים/ }));
    await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
    expect(setTaskDueDate).toHaveBeenCalledWith("task-1", "2026-09-26");
  });

  it("offers a week of slack before the legal date", async () => {
    await renderPicker();
    expect(screen.getByRole("button", { name: /שבוע לפני המועד החוקי.*8\.11\.2026/ })).toBeDefined();
  });
});

describe("the deadline that starts from a letter we cannot see", () => {
  it("computes the window from the demand date for הצהרת הון", async () => {
    // The rule is 120 days from the demand. Until now the user counted it.
    await renderPicker({ templateId: "capital-statement-prep", statutoryDueDate: null });
    const input = screen.getByLabelText(/מתי קיבלתם את הדרישה/);
    await userEvent.type(input, "2026-09-12");
    expect(screen.getByRole("button", { name: /120 יום מהדרישה.*10\.1\.2027/ })).toBeDefined();
  });

  it("does not ask about a demand for a task with a calendar deadline", async () => {
    await renderPicker();
    expect(screen.queryByLabelText(/מתי קיבלתם את הדרישה/)).toBeNull();
  });
});

describe("a target that plans to be late", () => {
  it("warns, and names the legal date", async () => {
    await renderPicker();
    await userEvent.type(screen.getByLabelText("או תאריך אחר"), "2026-12-01");
    const warning = screen.getByRole("status");
    expect(warning.textContent).toContain("15.11.2026");
    expect(warning.textContent).toMatch(/קנס|ריבית/);
  });

  it("stays quiet for a target before the legal date", async () => {
    await renderPicker();
    await userEvent.click(screen.getByRole("button", { name: /^בעוד שבוע\s/ }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not block saving it — the user may know something we do not", async () => {
    await renderPicker();
    await userEvent.type(screen.getByLabelText("או תאריך אחר"), "2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
    expect(setTaskDueDate).toHaveBeenCalledWith("task-1", "2026-12-01");
  });
});

describe("removing a target", () => {
  it("is offered only when one is set", async () => {
    await renderPicker();
    expect(screen.queryByRole("button", { name: /הסרת היעד/ })).toBeNull();

    cleanup();
    await renderPicker({ personalDueDate: "2026-10-01" });
    await userEvent.click(screen.getByRole("button", { name: /הסרת היעד/ }));
    expect(setTaskDueDate).toHaveBeenCalledWith("task-1", null);
  });
});
