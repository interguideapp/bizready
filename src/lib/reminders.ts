import { REMINDER_WINDOWS_FREE, REMINDER_WINDOWS_PRO } from "@/lib/compliance";
import type { Recurrence, TaskStatus, TaskTemplate } from "@/lib/types";

export interface ReminderTask {
  id: string; // business_task id
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
  due_date: string | null;
  completed_at: string | null;
  follow_up_date?: string | null;
  waiting_for?: string | null;
}

export type NotificationType = "deadline" | "overdue" | "recurring";

export interface NotificationDraft {
  type: NotificationType;
  title: string;
  body: string | null;
  template_id: string;
  dedupe_key: string;
}

export interface RecurringReset {
  taskId: string;
  templateId: string;
  newDueDate: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso + "T00:00:00Z");
  const toMid = new Date(isoDay(to) + "T00:00:00Z");
  return Math.round((from.getTime() - toMid.getTime()) / 86_400_000);
}

function addRecurrence(fromIso: string, recurrence: Recurrence): string {
  const d = new Date(fromIso.slice(0, 10) + "T00:00:00Z");
  if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (recurrence === "bimonthly") d.setUTCMonth(d.getUTCMonth() + 2);
  else if (recurrence === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return isoDay(d);
}

/**
 * Pure reminder engine. Given a business's tasks, decides:
 *  - which deadline / overdue notifications to raise (deduped so they aren't repeated)
 *  - which recurring tasks have come due again and should reset to "todo"
 */
export function computeReminders(
  tasks: ReminderTask[],
  templates: Map<string, TaskTemplate>,
  today: Date = new Date(),
  isPro = false
): { notifications: NotificationDraft[]; recurringResets: RecurringReset[] } {
  // Pro gets the full escalating runway; free gets a single 7-day nudge.
  const windows = isPro ? REMINDER_WINDOWS_PRO : REMINDER_WINDOWS_FREE;
  const notifications: NotificationDraft[] = [];
  const recurringResets: RecurringReset[] = [];

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    // recurring task that was completed and whose next cycle has arrived
    if (
      template.recurrence &&
      task.status === "done" &&
      task.completed_at
    ) {
      const nextDue = addRecurrence(task.completed_at, template.recurrence);
      if (daysBetween(nextDue, today) <= 0) {
        recurringResets.push({
          taskId: task.id,
          templateId: task.template_id,
          newDueDate: nextDue,
        });
        notifications.push({
          type: "recurring",
          title: `הגיע הזמן שוב: ${template.title}`,
          body: "משימה מחזורית חזרה — כדאי לטפל בה כדי לשמור על הציון.",
          template_id: task.template_id,
          dedupe_key: `recurring:${task.template_id}:${nextDue}`,
        });
      }
      continue;
    }

    // waiting on a third party: remind on the follow-up date the user picked
    if (task.status === "waiting") {
      if (task.follow_up_date && daysBetween(task.follow_up_date, today) <= 0) {
        notifications.push({
          type: "deadline",
          title: `זמן לבדוק: ${template.title}`,
          body: task.waiting_for
            ? `ממתין ל: ${task.waiting_for}`
            : "הגיע מועד הבדיקה שקבעת.",
          template_id: task.template_id,
          dedupe_key: `followup:${task.template_id}:${task.follow_up_date}`,
        });
      }
      continue;
    }

    // open task with a due date
    if (
      (task.status === "todo" || task.status === "in_progress") &&
      task.due_date
    ) {
      const daysLeft = daysBetween(task.due_date, today);
      if (daysLeft < 0) {
        notifications.push({
          type: "overdue",
          title: `באיחור: ${template.title}`,
          body: "המשימה הזו חרגה מהמועד — שווה לטפל בהקדם.",
          template_id: task.template_id,
          dedupe_key: `overdue:${task.template_id}:${task.due_date}`,
        });
      } else {
        // fire once per crossed window (30/14/7/1 for Pro; just 7 for free),
        // deduped per window so the same milestone never repeats.
        const window = windows.find((w) => daysLeft <= w);
        if (window !== undefined) {
          notifications.push({
            type: "deadline",
            title:
              daysLeft === 0
                ? `להיום: ${template.title}`
                : `בעוד ${daysLeft} ימים: ${template.title}`,
            body:
              window >= 14
                ? "דדליין מתקרב — יש עוד זמן להתארגן."
                : "דדליין מתקרב.",
            template_id: task.template_id,
            dedupe_key: `deadline:${task.template_id}:${task.due_date}:${window}`,
          });
        }
      }
    }
  }

  return { notifications, recurringResets };
}
