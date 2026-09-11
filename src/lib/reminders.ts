import { todayInIsrael, israelParts } from "@/lib/dates";
import {
  isStatutoryFiling,
  nextStatutoryDueDate,
  REMINDER_WINDOWS_FREE,
  REMINDER_WINDOWS_PRO,
  type ComplianceProfile,
} from "@/lib/compliance";
import type { Recurrence, TaskStatus, TaskTemplate } from "@/lib/types";

export interface ReminderTask {
  id: string; // business_task id
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
  due_date: string | null;
  /** The deadline the user set themselves (migration 028). */
  personal_due_date?: string | null;
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
  const toMid = new Date(todayInIsrael(to) + "T00:00:00Z");
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
 * Advance a stale date by whole cycles until it is no longer in the past.
 * Used to keep a recurring habit nudging: a monthly task that was never
 * completed used to keep its original due_date forever.
 */
function rollForward(fromIso: string, recurrence: Recurrence, today: Date): string {
  let next = fromIso.slice(0, 10);
  // guard against a pathological loop on bad data (20 years of monthly cycles)
  for (let i = 0; i < 240 && daysBetween(next, today) < 0; i++) {
    next = addRecurrence(next, recurrence);
  }
  return next;
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
  isPro = false,
  profile: ComplianceProfile = {}
): { notifications: NotificationDraft[]; recurringResets: RecurringReset[] } {
  // Pro gets the full escalating runway; free gets a single 7-day nudge.
  const windows = isPro ? REMINDER_WINDOWS_PRO : REMINDER_WINDOWS_FREE;
  const notifications: NotificationDraft[] = [];
  const recurringResets: RecurringReset[] = [];

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    const statutory = isStatutoryFiling(task.template_id);

    // ---------- a completed recurring task: has the next cycle arrived? ----------
    if (template.recurrence && task.status === "done" && task.completed_at) {
      if (statutory) {
        // The FILING CALENDAR decides, not "one cycle after you filed".
        //
        // Two defects lived here. (1) `template.recurrence` is a static string
        // ("bimonthly" on vat-reporting and income-tax-advances) that ignores the
        // business's actual vat_frequency — so a MONTHLY filer reopened every two
        // months and silently skipped every other statutory deadline. (2) The
        // trigger was completed_at + one cycle, which is structurally late for
        // anyone who files early: filing on 20 Jan reopened on 20 Mar, five days
        // AFTER the 15 Mar deadline.
        //
        // nextStatutoryDueDate is frequency-aware and always returns the next
        // not-yet-passed deadline, so "the period I filed for is no longer the
        // current one" is exactly the condition to reopen on.
        const periodDue = nextStatutoryDueDate(task.template_id, today, profile);
        // null means the obligation is demand-triggered (הצהרת הון): there is no
        // period to roll over to, so there is nothing to reopen.
        if (periodDue !== null && task.due_date !== periodDue) {
          recurringResets.push({
            taskId: task.id,
            templateId: task.template_id,
            newDueDate: periodDue,
          });
          notifications.push({
            type: "recurring",
            title: `תקופת דיווח חדשה: ${template.title}`,
            body: "נפתחה תקופת דיווח חדשה. הדיווח הקודם נשמר בהיסטוריה.",
            template_id: task.template_id,
            dedupe_key: `recurring:${task.template_id}:${periodDue}`,
          });
        }
        continue;
      }

      // A habit (bookkeeping, a yearly renewal): one cycle after it was last
      // done is the right semantics here.
      const trigger = addRecurrence(task.completed_at, template.recurrence);
      if (daysBetween(trigger, today) <= 0) {
        recurringResets.push({
          taskId: task.id,
          templateId: task.template_id,
          newDueDate: trigger,
        });
        notifications.push({
          type: "recurring",
          title: `הגיע הזמן שוב: ${template.title}`,
          body: "משימה מחזורית חזרה — כדאי לטפל בה.",
          template_id: task.template_id,
          dedupe_key: `recurring:${task.template_id}:${trigger}`,
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

    // open task with a due date, from either source
    if (
      (task.status === "todo" || task.status === "in_progress") &&
      (task.due_date || task.personal_due_date)
    ) {
      // An open recurring HABIT whose date has gone stale gets rolled forward.
      // Without this it kept its original due_date forever, and because the
      // dedupe key embeds that date it was byte-identical every single day — so
      // the task produced exactly ONE notification in the account's lifetime.
      //
      // Statutory filings are deliberately excluded: their date must be allowed
      // to fall into the past so a genuinely late filing still reports overdue.
      let systemDue = task.due_date;
      if (systemDue && template.recurrence && !statutory && daysBetween(systemDue, today) < 0) {
        const rolled = rollForward(systemDue, template.recurrence, today);
        if (rolled !== systemDue) {
          const previous = systemDue;
          systemDue = rolled;
          if (rolled !== previous) {
            recurringResets.push({
              taskId: task.id,
              templateId: task.template_id,
              newDueDate: rolled,
            });
          }
        }
      }

      // HOW A PERSONAL DEADLINE INTERACTS WITH A LEGAL ONE (migration 028).
      //
      // Non-statutory: the user's date simply is the deadline. It is their
      // task and there is no legal fact to protect.
      //
      // Statutory: their date can only pull the reminder EARLIER. It cannot
      // postpone the legal date, and — the important half — it can never
      // establish lateness. Judging "באיחור" from a personal target would let
      // a preference fabricate a legal breach, which is the defect the home
      // screen shipped with before the audit: two sources deciding overdue,
      // and the wrong one inventing debts.
      const personal = task.personal_due_date ?? null;
      const nudgeDue = statutory
        ? personal && systemDue && personal < systemDue
          ? personal
          : (systemDue ?? personal)
        : (personal ?? systemDue);
      const lateDue = statutory ? systemDue : nudgeDue;

      if (!nudgeDue) continue;

      const daysLeft = daysBetween(nudgeDue, today);
      const daysLate = lateDue ? daysBetween(lateDue, today) : 0;
      if (daysLate < 0) {
        // A red "overdue" is only honest for a real statutory deadline. A
        // recommended one-off (open your files, get insurance…) that slipped
        // past its suggested date is never an "איחור" — we stay quiet.
        if (statutory) {
          notifications.push({
            type: "overdue",
            title: `באיחור: ${template.title}`,
            body: "חרגתם מהמועד החוקי — כדאי לטפל בהקדם כדי לא לצבור קנסות.",
            template_id: task.template_id,
            dedupe_key: `overdue:${task.template_id}:${lateDue}`,
          });
        }
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
            dedupe_key: `deadline:${task.template_id}:${nudgeDue}:${window}`,
          });
        }
      }
    }
  }

  return { notifications, recurringResets };
}
