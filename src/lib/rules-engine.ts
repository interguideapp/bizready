import type {
  AppliesWhen,
  OnboardingAnswers,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
} from "@/lib/types";
import { PRIORITY_WEIGHT } from "@/lib/types";

/** True when a template's applies_when conditions match the given answers. */
export function templateApplies(
  appliesWhen: AppliesWhen,
  answers: OnboardingAnswers
): boolean {
  for (const [key, condition] of Object.entries(appliesWhen)) {
    const answer = answers[key as keyof OnboardingAnswers];
    if (Array.isArray(condition)) {
      if (!condition.includes(answer as never)) return false;
    } else if (answer !== condition) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the template's steps/why tailored to the business — the first variant
 * whose condition matches wins (e.g. attendance shows the app flow for remote
 * workers, the clock flow on-site). Pure, so the task page can call it directly.
 */
export function resolveTemplate(
  template: TaskTemplate,
  answers: OnboardingAnswers | Record<string, never>
): { steps: string; why: string } {
  if (template.variants && "entity_type" in answers) {
    for (const variant of template.variants) {
      if (templateApplies(variant.when, answers as OnboardingAnswers)) {
        return { steps: variant.steps, why: variant.why ?? template.why };
      }
    }
  }
  return { steps: template.steps, why: template.why };
}

export interface PlannedTask {
  template_id: string;
  status: TaskStatus;
  due_date: string | null; // ISO date
  is_relevant: boolean;
}

/**
 * Pure planning function: answers + templates -> the personalized plan.
 * Templates the user marked in "מה כבר יש?" start as done.
 */
export function buildPlan(
  answers: OnboardingAnswers,
  templates: TaskTemplate[],
  today: Date = new Date()
): PlannedTask[] {
  const alreadyDone = new Set(answers.already_done ?? []);
  return templates
    .filter((t) => templateApplies(t.applies_when, answers))
    .map((t) => ({
      template_id: t.id,
      status: alreadyDone.has(t.id) ? ("done" as const) : ("todo" as const),
      due_date:
        t.deadline_days != null ? addDays(today, t.deadline_days) : null,
      is_relevant: true,
    }));
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reconcile an existing set of tasks with new answers (user edited the profile).
 * - Newly applicable templates are added.
 * - Tasks whose rule no longer applies are flagged is_relevant=false (history kept).
 * - Tasks that apply again are re-flagged relevant.
 */
export function reconcilePlan(
  answers: OnboardingAnswers,
  templates: TaskTemplate[],
  existing: { template_id: string; is_relevant: boolean }[],
  today: Date = new Date()
): {
  toAdd: PlannedTask[];
  toFlagIrrelevant: string[]; // template_ids
  toFlagRelevant: string[]; // template_ids
} {
  const existingIds = new Set(existing.map((t) => t.template_id));
  const plan = buildPlan(answers, templates, today);
  const applicableIds = new Set(plan.map((t) => t.template_id));

  return {
    toAdd: plan.filter((t) => !existingIds.has(t.template_id)),
    toFlagIrrelevant: existing
      .filter((t) => t.is_relevant && !applicableIds.has(t.template_id))
      .map((t) => t.template_id),
    toFlagRelevant: existing
      .filter((t) => !t.is_relevant && applicableIds.has(t.template_id))
      .map((t) => t.template_id),
  };
}

// ============ readiness score ============

export interface ScoredTask {
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
}

export interface CategoryScore {
  category_id: string;
  score: number; // 0-100
  done: number;
  total: number;
}

export interface ReadinessScore {
  overall: number; // 0-100
  byCategory: CategoryScore[];
}

/**
 * Weighted readiness score. Only relevant tasks count; "not_relevant" and
 * is_relevant=false are excluded. in_progress earns half credit.
 */
export function computeScore(
  tasks: ScoredTask[],
  templates: Map<string, TaskTemplate>
): ReadinessScore {
  const perCategory = new Map<
    string,
    { earned: number; possible: number; done: number; total: number }
  >();
  let earnedAll = 0;
  let possibleAll = 0;

  for (const task of tasks) {
    if (!task.is_relevant || task.status === "not_relevant") continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    const weight = PRIORITY_WEIGHT[template.priority as TaskPriority];
    // in-flight work earns partial credit; waiting on a third party counts too
    const credit =
      task.status === "done"
        ? 1
        : task.status === "in_progress" || task.status === "waiting"
          ? 0.5
          : 0;

    const bucket = perCategory.get(template.category_id) ?? {
      earned: 0,
      possible: 0,
      done: 0,
      total: 0,
    };
    bucket.earned += weight * credit;
    bucket.possible += weight;
    bucket.total += 1;
    if (task.status === "done") bucket.done += 1;
    perCategory.set(template.category_id, bucket);

    earnedAll += weight * credit;
    possibleAll += weight;
  }

  return {
    overall: possibleAll === 0 ? 0 : Math.round((earnedAll / possibleAll) * 100),
    byCategory: [...perCategory.entries()].map(([category_id, b]) => ({
      category_id,
      score: b.possible === 0 ? 0 : Math.round((b.earned / b.possible) * 100),
      done: b.done,
      total: b.total,
    })),
  };
}

/**
 * "הצעדים הבאים" — the next best actions: open tasks whose dependencies are
 * all done, ordered by priority then due date.
 */
export function nextSteps(
  tasks: (ScoredTask & { due_date: string | null })[],
  templates: Map<string, TaskTemplate>,
  limit = 3
): string[] {
  const statusById = new Map(tasks.map((t) => [t.template_id, t.status]));
  const open = tasks.filter(
    (t) =>
      t.is_relevant &&
      (t.status === "todo" || t.status === "in_progress") &&
      templates.has(t.template_id)
  );

  const unblocked = open.filter((t) => {
    const template = templates.get(t.template_id)!;
    return template.depends_on.every((dep) => {
      const depStatus = statusById.get(dep);
      // deps not in the plan (not applicable) don't block
      return depStatus === undefined || depStatus === "done" || depStatus === "not_relevant";
    });
  });

  const priorityRank: Record<TaskPriority, number> = {
    critical: 0,
    important: 1,
    recommended: 2,
  };

  return unblocked
    .sort((a, b) => {
      const ta = templates.get(a.template_id)!;
      const tb = templates.get(b.template_id)!;
      const byPriority = priorityRank[ta.priority] - priorityRank[tb.priority];
      if (byPriority !== 0) return byPriority;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return ta.sort_order - tb.sort_order;
    })
    .slice(0, limit)
    .map((t) => t.template_id);
}
