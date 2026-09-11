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
    // free plan: the 7-day window
    expect(notifications[0].dedupe_key).toBe("deadline:open-vat-file:2026-07-23:7");
  });

  it("Pro gets an earlier (30-day) reminder that free does not", () => {
    // 21 days out → within Pro's 30 window, outside free's 7
    const mkTasks = () => [
      task({ template_id: "open-vat-file", due_date: "2026-08-10" }),
    ];
    const free = computeReminders(mkTasks(), TEMPLATES_BY_ID, today, false);
    const pro = computeReminders(mkTasks(), TEMPLATES_BY_ID, today, true);
    expect(free.notifications).toHaveLength(0);
    expect(pro.notifications).toHaveLength(1);
    expect(pro.notifications[0].dedupe_key).toBe("deadline:open-vat-file:2026-08-10:30");
  });

  it("raises an overdue notification only for a statutory filing past its date", () => {
    const { notifications } = computeReminders(
      [task({ template_id: "vat-reporting", due_date: "2026-07-10" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications[0].type).toBe("overdue");
    expect(notifications[0].dedupe_key).toBe("overdue:vat-reporting:2026-07-10");
  });

  it("never cries 'overdue' about a slipped recommendation (non-statutory)", () => {
    // open-vat-file is a one-off recommendation, not a statutory filing —
    // a passed date is honest silence, not a red alarm.
    const { notifications } = computeReminders(
      [task({ template_id: "open-vat-file", due_date: "2026-07-10" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(0);
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

  it("reminds to check a waiting task once its follow-up date arrives", () => {
    const { notifications } = computeReminders(
      [
        task({
          template_id: "business-license",
          status: "waiting",
          follow_up_date: "2026-07-19",
          waiting_for: "הוגשה בקשה לעירייה",
        }),
      ],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].dedupe_key).toBe("followup:business-license:2026-07-19");
    expect(notifications[0].body).toContain("הוגשה בקשה לעירייה");
  });

  it("stays quiet on a waiting task whose follow-up is still ahead", () => {
    const { notifications } = computeReminders(
      [
        task({
          template_id: "business-license",
          status: "waiting",
          follow_up_date: "2026-08-30",
        }),
      ],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(0);
  });

  it("never nags about a waiting task's original due date", () => {
    // due long past, but we're waiting on a third party with no follow-up set
    const { notifications } = computeReminders(
      [
        task({
          template_id: "business-license",
          status: "waiting",
          due_date: "2026-01-01",
        }),
      ],
      TEMPLATES_BY_ID,
      today
    );
    expect(notifications).toHaveLength(0);
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

describe("statutory recurrence is calendar-driven, not completion-driven", () => {
  // vat-reporting carries a static recurrence: "bimonthly". The reset used to be
  // addRecurrence(completed_at, that string), so a MONTHLY filer reopened every
  // two months and silently skipped every other statutory deadline.
  const mar20 = new Date("2026-03-20T09:00:00Z");

  it("reopens a MONTHLY filer on the monthly calendar", () => {
    const { recurringResets } = computeReminders(
      [task({ template_id: "vat-reporting", status: "done", completed_at: "2026-03-10", due_date: "2026-03-15" })],
      TEMPLATES_BY_ID,
      mar20,
      false,
      { vatFrequency: "monthly" }
    );
    expect(recurringResets).toHaveLength(1);
    expect(recurringResets[0].newDueDate).toBe("2026-04-15");
  });

  it("reopens a BIMONTHLY filer on the bimonthly calendar", () => {
    const { recurringResets } = computeReminders(
      [task({ template_id: "vat-reporting", status: "done", completed_at: "2026-03-10", due_date: "2026-03-15" })],
      TEMPLATES_BY_ID,
      mar20,
      false,
      { vatFrequency: "bimonthly" }
    );
    expect(recurringResets).toHaveLength(1);
    expect(recurringResets[0].newDueDate).toBe("2026-05-15");
  });

  it("anchors the reopen to the calendar, not to when you happened to file", () => {
    const run = (completedAt: string) =>
      computeReminders(
        [task({ template_id: "vat-reporting", status: "done", completed_at: completedAt, due_date: "2026-03-15" })],
        TEMPLATES_BY_ID,
        mar20,
        false,
        { vatFrequency: "monthly" }
      ).recurringResets[0].newDueDate;
    // filing three days after the period opened vs. on the deadline itself
    expect(run("2026-03-01")).toBe(run("2026-03-15"));
  });

  it("does not reopen while the filed period is still the current one", () => {
    const { recurringResets } = computeReminders(
      [task({ template_id: "vat-reporting", status: "done", completed_at: "2026-03-18", due_date: "2026-04-15" })],
      TEMPLATES_BY_ID,
      mar20,
      false,
      { vatFrequency: "monthly" }
    );
    expect(recurringResets).toHaveLength(0);
  });

  it("a monthly filer is offered all twelve periods across a year — none skipped", () => {
    const seen = new Set<string>();
    let due = "2026-01-15";
    for (let month = 0; month < 12; month++) {
      const onThe20th = new Date(Date.UTC(2026, month, 20, 9, 0, 0));
      const { recurringResets } = computeReminders(
        [task({ template_id: "vat-reporting", status: "done", completed_at: due, due_date: due })],
        TEMPLATES_BY_ID,
        onThe20th,
        false,
        { vatFrequency: "monthly" }
      );
      if (recurringResets.length > 0) {
        due = recurringResets[0].newDueDate;
        seen.add(due);
      }
    }
    expect(seen.size).toBe(12);
  });

  it("never rolls a statutory filing forward — a late filing must stay overdue", () => {
    const { notifications, recurringResets } = computeReminders(
      [task({ template_id: "vat-reporting", due_date: "2026-07-10" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(recurringResets).toHaveLength(0);
    expect(notifications[0].type).toBe("overdue");
  });
});

describe("an open recurring habit keeps nudging", () => {
  it("rolls a stale date forward instead of dying after one notification", () => {
    // bookkeeping is monthly. A never-completed task kept its original due_date
    // forever, and the dedupe key embeds that date — so it was byte-identical
    // every day and produced exactly ONE notification, ever.
    const { recurringResets } = computeReminders(
      [task({ template_id: "bookkeeping", due_date: "2026-04-10" })],
      TEMPLATES_BY_ID,
      today
    );
    expect(recurringResets).toHaveLength(1);
    expect(recurringResets[0].newDueDate).toBe("2026-08-10");
  });

  it("gives each cycle a distinct dedupe key so reminders are not collapsed", () => {
    const keyFor = (dueDate: string) =>
      computeReminders(
        [task({ template_id: "bookkeeping", due_date: dueDate })],
        TEMPLATES_BY_ID,
        new Date("2026-07-12T09:00:00Z")
      ).notifications.map((x) => x.dedupe_key);
    // due in 3 days -> a real 7-day-window reminder, keyed to that date
    expect(keyFor("2026-07-15")).toEqual(["deadline:bookkeeping:2026-07-15:7"]);
    // a different cycle produces a different key
    expect(keyFor("2026-07-14")).toEqual(["deadline:bookkeeping:2026-07-14:7"]);
  });
});
