import { todayInIsrael } from "@/lib/dates";
import {
  isStatutoryFiling,
  nextStatutoryDueDate,
  REMINDER_WINDOWS_FREE,
  REMINDER_WINDOWS_PRO,
  type ComplianceProfile,
} from "@/lib/compliance";
import { filingRuleFor } from "@/lib/content/filing-rules";
import { periodForDue } from "@/lib/filings";
import { reopenedCycle } from "@/lib/cycles";
import { satisfiesDependency, type Dismissal } from "@/lib/task-status";
import type { Recurrence, TaskStatus, TaskTemplate } from "@/lib/types";

export interface ReminderTask {
  id: string; // business_task id
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
  due_date: string | null;
  /**
   * not_applicable / handled_externally. Needed for the prerequisite gate: a
   * dismissed setup task must not be what starts a penalty-bearing duty running.
   */
  dismissal?: Dismissal | null;
  /** The deadline the user set themselves (migration 028). */
  personal_due_date?: string | null;
  completed_at: string | null;
  /** Evidence from the completion flow; carries the renewal date if one was given. */
  completion_data?: Record<string, unknown> | null;
  /** Period keys already in the filing ledger (030), for the cycle decision. */
  filed_periods?: string[];
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

  // THE PREREQUISITE GATE, which this engine did not have.
  //
  // computeUpcomingObligations has applied it since the audit: a statutory
  // filing duty is real only once the setup task that unlocks it is done, because
  // you owe no VAT report before the VAT file exists. This engine skipped the
  // check entirely — so a new עוסק מורשה whose plan gave vat-reporting a
  // plan-build date, and who had not opened the file yet, was EMAILED,
  // PUSHED and WhatsApp'd "באיחור: דיווח מע"מ" for a duty that did not legally
  // exist. The same defect A9 removed from the home screen, in the loudest
  // channel the product has.
  //
  // satisfiesDependency owns the rule for every engine, and { statutory: true }
  // is what stops a mere "not relevant" on the setup task from opening the gate.
  const taskById = new Map(tasks.map((t) => [t.template_id, t] as const));
  const prereqsMet = (template: TaskTemplate) =>
    template.depends_on.every((dep) => {
      const dt = taskById.get(dep);
      return satisfiesDependency(
        dt && { status: dt.status as TaskStatus, is_relevant: dt.is_relevant, dismissal: dt.dismissal },
        { statutory: true }
      );
    });

  for (const task of tasks) {
    if (!task.is_relevant) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    const statutory = isStatutoryFiling(task.template_id);
    // No duty yet means nothing to remind about, and certainly nothing late.
    if (statutory && !prereqsMet(template)) continue;

    // ---------- a completed recurring duty: has the next cycle opened? ----------
    //
    // The decision used to be made here, and here only. That was the defect:
    // this sweep was the ONLY thing in the product that could conclude a new
    // period had opened, so with the sweep not running a filed VAT task read
    // "בוצע" while the next deadline came and went — and the obligations board,
    // which computes its dates independently, said the opposite about the same
    // penalty-bearing duty.
    //
    // It now lives in cycles.ts, which the screens call too. One function, two
    // callers, nothing left to disagree about. The sweep's job here is narrowed
    // to what only it can do: persist the conclusion and send the message.
    if (task.status === "done") {
      const cycle = reopenedCycle({ task, template, today, profile });
      if (cycle) {
        recurringResets.push({
          taskId: task.id,
          templateId: task.template_id,
          newDueDate: cycle.dueIso,
        });
        notifications.push({
          type: "recurring",
          title:
            cycle.reason === "renewal"
              ? `מועד חידוש: ${template.title}`
              : cycle.reason === "period"
                ? `תקופת דיווח חדשה: ${template.title}`
                : `הגיע הזמן שוב: ${template.title}`,
          body:
            cycle.reason === "renewal"
              ? "לפי תאריך החידוש שרשמתם. כדאי לחדש לפני המועד כדי לא להישאר ללא כיסוי."
              : cycle.reason === "period"
                ? (cycle.periodLabel
                    ? `נפתחה תקופת הדיווח ${cycle.periodLabel}. הדיווח הקודם נשמר בהיסטוריה.`
                    : "נפתחה תקופת דיווח חדשה. הדיווח הקודם נשמר בהיסטוריה.")
                : "משימה מחזורית חזרה — כדאי לטפל בה.",
          template_id: task.template_id,
          dedupe_key: `recurring:${task.template_id}:${cycle.dueIso}`,
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
          // NAME THE PERIOD.
          //
          // "באיחור: דיווח מע\"מ" does not say late for WHAT, and now that a
          // period is a first-class thing the product tracks it can. This
          // matters most here rather than on screen: an email or a WhatsApp
          // is often all someone sees for days, and if two periods are
          // outstanding they need to know which one this is about.
          //
          // Only for period_plus rules. A monthly 102 or an annual return has
          // no bimonthly period, and labelling one would be inventing a fact.
          const rule = filingRuleFor(task.template_id);
          const period =
            rule?.rule.anchor === "period_plus" && lateDue
              ? periodForDue(lateDue, profile.vatFrequency ?? "bimonthly")
              : null;
          notifications.push({
            type: "overdue",
            title: period
              ? "באיחור: " + template.title + " (" + period.label + ")"
              : "באיחור: " + template.title,
            body: "חרגתם מהמועד החוקי — כדאי לטפל בהקדם כדי לא לצבור קנסות.",
            template_id: task.template_id,
            // Unchanged: keyed on the date, so naming the period does not
            // re-notify anyone who was already told.
            dedupe_key: "overdue:" + task.template_id + ":" + lateDue,
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
