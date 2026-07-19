import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { computeReminders, type ReminderTask } from "./reminders";

const today = new Date("2026-07-19T09:00:00Z");

function task(partial: Partial<ReminderTask> & { template_id: string }): ReminderTask {
  return {
    id: `bt-${partial.template_id}`,
    status: "todo",
    is_relevant: true,
    due_date: null,
    completed_at: null,
    ...partial,
  };
}

describe("computeReminders", () => {
  it("raises a deadline notification within the 7-day window", () => {
    const { notifications } = computeReminders(
      [task({ template_id: "open-vat-file", due_date: "2026-07-23" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("deadline");
    expect(notifications[0].dedupe_key).toBe("deadline:open-vat-file:2026-07-23");
  });

  it("raises an overdue notification for past due dates", () => {
    const { notifications } = computeReminders(
      [task({ template_id: "open-vat-file", due_date: "2026-07-10" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications[0].type).toBe("overdue");
  });

  it("ignores due dates further than a week away", () => {
    const { notifications } = computeReminders(
      [task({ template_id: "open-vat-file", due_date: "2026-09-01" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(0);
  });

  it("ignores done and not-relevant tasks", () => {
    const { notifications } = computeReminders(
      [
        task({ template_id: "open-vat-file", due_date: "2026-07-20", status: "done" }),
        task({ template_id: "open-income-tax-file", due_date: "2026-07-20", is_relevant: false }),
      ],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(0);
  });

  it("resets a recurring task once its next cycle arrives", () => {
    // bookkeeping is monthly; completed 2026-06-15 -> next due 2026-07-15 (past today)
    const { notifications, recurringResets } = computeReminders(
      [task({ template_id: "bookkeeping", status: "done", completed_at: "2026-06-15" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(recurringResets).toHaveLength(1);
    expect(recurringResets[0].newDueDate).toBe("2026-07-15");
    expect(notifications[0].type).toBe("recurring");
  });

  it("does not reset a recurring task before its cycle elapses", () => {
    // completed yesterday -> next monthly due is a month out
    const { recurringResets } = computeReminders(
      [task({ template_id: "bookkeeping", status: "done", completed_at: "2026-07-18" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(recurringResets).toHaveLength(0);
  });
});
