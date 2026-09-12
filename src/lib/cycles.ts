import { todayInIsrael } from "@/lib/dates";
import {
  isStatutoryFiling,
  nextStatutoryDueDate,
  type ComplianceProfile,
  type VatFrequency,
} from "@/lib/compliance";
import { filingRuleFor } from "@/lib/content/filing-rules";
import { FILING_RECORD_SINCE, missedPeriodsFor, periodForDue } from "@/lib/filings";
import type { Recurrence, TaskStatus, TaskTemplate } from "@/lib/types";

/**
 * What comes next after a recurring duty was closed.
 *
 * This is the question the product could not answer. A VAT report filed for
 * Jul–Aug set the row to `done` and left it there: the ONLY thing that ever
 * reopened it was the nightly sweep (reminders.ts), and if the sweep does not
 * run — which is the situation this product is built to survive — the task read
 * "בוצע" forever while the next period's deadline came and went. The
 * obligations board computed the next occurrence independently and was right,
 * so the two surfaces disagreed about whether a penalty-bearing duty was
 * outstanding. Exactly the one-truth failure this pass exists to remove.
 *
 * So the answer is derived, not stored. One function decides whether a new
 * cycle has opened, the sweep and the screens both call it, and they cannot
 * disagree because there is nothing left to disagree with.
 *
 * Three shapes of cycle, in descending order of how much the date is owed to
 * the user's own facts rather than chosen by us:
 *
 *   period   a statutory reporting period. The filing ledger (030) is the
 *            authority on which periods are filed, so a period whose deadline
 *            passed with no record can be named exactly.
 *
 *   renewal  a policy, licence or certificate with an expiry the user gave us.
 *            Anchored to THAT date, not to when the task was ticked — a policy
 *            bought in March and expiring in January renews in January.
 *
 *   habit    bookkeeping, a yearly review: one interval after it was last done
 *            is genuinely the right semantics, because nothing external fixes
 *            the date.
 */

export type CycleReason = "period" | "renewal" | "habit";

export interface CycleTask {
  template_id: string;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  completion_data?: Record<string, unknown> | null;
  /** Period keys recorded in the filing ledger for this template (030). */
  filed_periods?: string[];
}

export interface OpenCycle {
  reason: CycleReason;
  /** The deadline of the cycle that is now open. */
  dueIso: string;
  /** Named for a statutory period; null for a renewal or a habit. */
  periodLabel: string | null;
  periodKey: string | null;
}

export interface NextCycle {
  reason: CycleReason;
  dueIso: string;
  periodLabel: string | null;
  periodKey: string | null;
  /** Has its deadline arrived, i.e. is this cycle open right now? */
  open: boolean;
}

function addRecurrence(fromIso: string, recurrence: Recurrence): string {
  const d = new Date(fromIso.slice(0, 10) + "T00:00:00Z");
  if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (recurrence === "bimonthly") d.setUTCMonth(d.getUTCMonth() + 2);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The same default compliance.ts applies. Duplicated as one line rather than
 * widening that module's exported surface; a test asserts the two agree, so it
 * cannot drift silently.
 */
function frequencyOf(profile: ComplianceProfile): VatFrequency {
  return profile.vatFrequency ?? "bimonthly";
}

/** A yyyy-mm-dd out of the renewal completion field, or null if there isn't one. */
export function renewalDateOf(task: CycleTask): string | null {
  const raw = task.completion_data?.renewal;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const d = new Date(raw.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : raw.slice(0, 10);
}

/**
 * The next cycle of a recurring duty, whether or not it has arrived yet.
 *
 * Answers both halves of the question with one call: "when is the next one"
 * (always) and "has it already arrived" (`open`). This is what lets a task
 * that was just filed say what is coming instead of only saying "done".
 *
 * Returns null when there is no next cycle to speak of — a one-off task, or a
 * demand-triggered duty like הצהרת הון where inventing a date is the bug.
 */
export function nextCycleFor(args: {
  task: CycleTask;
  template: TaskTemplate;
  today: Date;
  profile?: ComplianceProfile;
}): NextCycle | null {
  const { task, template, today } = args;
  const profile = args.profile ?? {};
  const todayIso = todayInIsrael(today);

  // --- a statutory reporting period ---
  const entry = filingRuleFor(task.template_id);
  if (entry || isStatutoryFiling(task.template_id)) {
    const dueIso = nextStatutoryDueDate(task.template_id, today, profile);
    // null is on_demand (הצהרת הון) or an annual filing whose date the
    // authority has not published. Both mean "we do not know", and the honest
    // answer to "when is the next one" is then nothing at all.
    if (!dueIso) return null;
    const period =
      entry?.rule.anchor === "period_plus" ? periodForDue(dueIso, frequencyOf(profile)) : null;
    return {
      reason: "period",
      dueIso,
      periodLabel: period?.label ?? null,
      periodKey: period?.key ?? null,
      // False by construction here, since this is the next deadline that has
      // NOT passed. Carried anyway because the field means the same thing on
      // all three branches and a caller should not have to know which one it
      // came from.
      open: dueIso <= todayIso,
    };
  }

  // --- a renewal, dated by the user's own document ---
  const renewal = renewalDateOf(task);
  if (renewal) {
    return {
      reason: "renewal",
      dueIso: renewal,
      periodLabel: null,
      periodKey: null,
      open: renewal <= todayIso,
    };
  }

  // --- a habit ---
  if (template.recurrence && task.completed_at) {
    const dueIso = addRecurrence(task.completed_at, template.recurrence);
    return {
      reason: "habit",
      dueIso,
      periodLabel: null,
      periodKey: null,
      open: dueIso <= todayIso,
    };
  }

  return null;
}

/**
 * Is a closed recurring duty in fact open again?
 *
 * Only ever asked of a `done` task: an open task needs no reopening, and
 * claiming otherwise would double-count the same duty on every surface that
 * counts open work.
 *
 * For a reporting period the answer is in two parts, in this order, because the
 * order is what keeps the date honest:
 *
 *   1. a period whose deadline has already passed with no filing record — owed,
 *      and owed LATE, so the task must carry that date;
 *   2. otherwise the period now running, opened as soon as the filed one is
 *      behind us, so the user works toward the deadline instead of hearing
 *      about it afterwards.
 */
export function reopenedCycle(args: {
  task: CycleTask;
  template: TaskTemplate;
  today: Date;
  profile?: ComplianceProfile;
}): OpenCycle | null {
  const { task, template, today } = args;
  const profile = args.profile ?? {};
  if (task.status !== "done") return null;
  const todayIso = todayInIsrael(today);

  const entry = filingRuleFor(task.template_id);
  if (entry) {
    const nextDue = nextStatutoryDueDate(task.template_id, today, profile);
    if (!nextDue) return null;

    if (entry.rule.anchor === "period_plus") {
      const freq: VatFrequency = frequencyOf(profile);
      // The period now RUNNING: the one whose deadline is the next to fall.
      const current = periodForDue(nextDue, freq);
      if (!current) return null;

      // (1) Owed and late. Checked before the running period so the task
      // carries the overdue date rather than a comfortable future one — the
      // "באיחור" / "in 56 days" split the two engines used to produce.
      //
      // Uses the obligations board's own helper, with the same honesty guard:
      // nothing earlier than the ledger itself is reported, because an absent
      // record from before recording began is not an absent filing. Sharing the
      // function is what makes the task and the board incapable of disagreeing.
      if (task.filed_periods && task.due_date) {
        const owed = missedPeriodsFor({
          firstDueIso: task.due_date,
          todayIso,
          frequency: freq,
          filedKeys: task.filed_periods,
          knownFrom: FILING_RECORD_SINCE,
        })[0];
        if (owed) {
          return {
            reason: "period",
            dueIso: owed.dueIso,
            periodLabel: owed.label,
            periodKey: owed.key,
          };
        }
      }

      // (2) The period now running.
      if (task.filed_periods) {
        // Filed early: nothing to reopen until the period after this one.
        if (task.filed_periods.includes(current.key)) return null;
      } else if (task.due_date === current.dueIso) {
        // No ledger: the stored deadline is the only statement of which period
        // this completion covered, and it still points at the running one.
        return null;
      }
      return {
        reason: "period",
        dueIso: current.dueIso,
        periodLabel: current.label,
        periodKey: current.key,
      };
    }

    // An annual or monthly filing on a fixed calendar date. The completion
    // covers the deadline stored on the row; once the next one differs, a new
    // cycle has opened.
    if (task.due_date === nextDue) return null;
    return { reason: "period", dueIso: nextDue, periodLabel: null, periodKey: null };
  }

  const renewal = renewalDateOf(task);
  if (renewal) {
    // Reopened ON the renewal date, not after it: the whole point of a renewal
    // is that there must not be a single day without cover.
    return renewal <= todayIso
      ? { reason: "renewal", dueIso: renewal, periodLabel: null, periodKey: null }
      : null;
  }

  if (template.recurrence && task.completed_at) {
    const dueIso = addRecurrence(task.completed_at, template.recurrence);
    return dueIso <= todayIso
      ? { reason: "habit", dueIso, periodLabel: null, periodKey: null }
      : null;
  }

  return null;
}

/**
 * Project reopened cycles onto a task list.
 *
 * The stored row is NOT rewritten here — this is a read-time projection, and
 * the sweep persists the identical conclusion when it runs because it calls the
 * same function. What the screens must never do is render "בוצע" for a duty
 * that is currently outstanding, which is what they did before this existed.
 *
 * `cycle` travels with the task so the UI can say WHY it is open again rather
 * than silently un-ticking something the user remembers finishing.
 */
export function projectCycles<T extends CycleTask>(
  tasks: T[],
  args: {
    templates: Map<string, TaskTemplate>;
    today: Date;
    profile?: ComplianceProfile;
    filedPeriods?: Map<string, string[]>;
  }
): (T & { cycle?: OpenCycle })[] {
  return tasks.map((task) => {
    const template = args.templates.get(task.template_id);
    if (!template) return task;
    const cycle = reopenedCycle({
      task: {
        ...task,
        filed_periods: task.filed_periods ?? args.filedPeriods?.get(task.template_id),
      },
      template,
      today: args.today,
      profile: args.profile,
    });
    if (!cycle) return task;
    return {
      ...task,
      status: "todo" as TaskStatus,
      completed_at: null,
      due_date: cycle.dueIso,
      cycle,
    };
  });
}

/** How the reopening reads on screen. */
export const CYCLE_REASON_TEXT: Record<CycleReason, string> = {
  period: "נפתחה תקופת דיווח חדשה",
  renewal: "הגיע מועד החידוש",
  habit: "חזר לפי המחזוריות שהוגדרה",
};
