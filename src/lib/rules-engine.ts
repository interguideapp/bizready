import type {
  AppliesWhen,
  OnboardingAnswers,
  OrderedCondition,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
} from "@/lib/types";
import { ANSWER_ORDER, PRIORITY_WEIGHT } from "@/lib/types";
import { interpolateFigures } from "@/lib/content/figures";
import {
  countsTowardScore,
  dismissalOf,
  satisfiesDependency,
  type Dismissal,
} from "@/lib/task-status";
import {
  isStatutoryFiling,
  nextStatutoryDueDate,
  type ComplianceProfile,
} from "@/lib/compliance";

/** The handful of real facts that drive statutory dates, pulled from answers. */
export function profileFromAnswers(answers: OnboardingAnswers): ComplianceProfile {
  return {
    entityType: answers.entity_type,
    vatFrequency: answers.vat_frequency,
  };
}

/**
 * True when a template's applies_when predicate matches the given answers.
 *
 * The flat object form ANDs across keys and ORs within a key. `not`/`any`/`all`
 * compose, and `atLeast`/`atMost` compare against ANSWER_ORDER.
 *
 * An unknown key is a bug, not a rule: it used to read `undefined`, fail every
 * comparison, and silently delete the template from every plan. Unknown keys are
 * now rejected at build time by invariants.test.ts; at runtime we treat a key the
 * answers do not carry as "not matched" so behaviour stays conservative rather
 * than accidentally including a task.
 */
export function templateApplies(
  appliesWhen: AppliesWhen,
  answers: OnboardingAnswers
): boolean {
  if ("not" in appliesWhen) return !templateApplies(appliesWhen.not, answers);
  if ("any" in appliesWhen) return appliesWhen.any.some((p) => templateApplies(p, answers));
  if ("all" in appliesWhen) return appliesWhen.all.every((p) => templateApplies(p, answers));
  if ("atLeast" in appliesWhen) return compareOrdered(appliesWhen.atLeast, answers, "atLeast");
  if ("atMost" in appliesWhen) return compareOrdered(appliesWhen.atMost, answers, "atMost");

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
 * Compares an ordered answer against a threshold. An answer that is missing, or
 * not on the declared scale, does not satisfy the threshold — an unanswered
 * turnover question must never be read as "over the ceiling".
 */
function compareOrdered(
  condition: OrderedCondition,
  answers: OnboardingAnswers,
  mode: "atLeast" | "atMost"
): boolean {
  for (const [key, bound] of Object.entries(condition)) {
    const scale = ANSWER_ORDER[key as keyof typeof ANSWER_ORDER] as readonly string[] | undefined;
    if (!scale) return false;
    const answerRank = scale.indexOf(answers[key as keyof OnboardingAnswers] as string);
    const boundRank = scale.indexOf(bound as string);
    if (answerRank < 0 || boundRank < 0) return false;
    if (mode === "atLeast" ? answerRank < boundRank : answerRank > boundRank) return false;
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
  // Figure tokens are resolved here, at the single point every caller goes
  // through, so an amount can never be rendered straight from the template
  // source with its {{token}} showing.
  if (template.variants && "entity_type" in answers) {
    for (const variant of template.variants) {
      if (templateApplies(variant.when, answers as OnboardingAnswers)) {
        return {
          steps: interpolateFigures(variant.steps),
          why: interpolateFigures(variant.why ?? template.why),
        };
      }
    }
  }
  return {
    steps: interpolateFigures(template.steps),
    why: interpolateFigures(template.why),
  };
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
  const profile = profileFromAnswers(answers);
  return templates
    .filter((t) => templateApplies(t.applies_when, answers))
    .map((t) => ({
      template_id: t.id,
      status: alreadyDone.has(t.id) ? ("done" as const) : ("todo" as const),
      // statutory filings get their real, anchored next date; everything else
      // keeps a soft recommended date (X days from now = from business start).
      due_date: isStatutoryFiling(t.id)
        ? nextStatutoryDueDate(t.id, today, profile)
        : t.deadline_days != null
          ? addDays(today, t.deadline_days)
          : null,
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

/** One task that a recalibration would add, hide, or bring back. */
export interface PlanChange {
  templateId: string;
  title: string;
  categoryId: string;
  priority: TaskPriority;
}

/** Human-readable, category-aware view of a reconcile — for the "כיול" preview. */
export interface ReconcileSummary {
  added: PlanChange[]; // brand-new tasks the profile now needs
  removed: PlanChange[]; // tasks that no longer apply (hidden, history kept)
  restored: PlanChange[]; // previously-hidden tasks that apply again
  changed: boolean;
}

/**
 * Resolve a raw reconcile result into named, prioritized task lists so the UI
 * can show the user exactly what a profile change does to their plan *before*
 * they commit it. Pure: unknown template ids are dropped, criticals first.
 */
export function summarizeReconcile(
  result: {
    toAdd: PlannedTask[];
    toFlagIrrelevant: string[];
    toFlagRelevant: string[];
  },
  templates: Map<string, TaskTemplate>
): ReconcileSummary {
  const rank: Record<TaskPriority, number> = {
    critical: 0,
    important: 1,
    recommended: 2,
  };
  const toChange = (templateId: string): PlanChange | null => {
    const t = templates.get(templateId);
    if (!t) return null;
    return {
      templateId,
      title: t.title,
      categoryId: t.category_id,
      priority: t.priority,
    };
  };
  const resolve = (ids: string[]) =>
    ids
      .map(toChange)
      .filter((c): c is PlanChange => c !== null)
      .sort((a, b) => rank[a.priority] - rank[b.priority]);

  const added = resolve(result.toAdd.map((t) => t.template_id));
  const removed = resolve(result.toFlagIrrelevant);
  const restored = resolve(result.toFlagRelevant);
  return {
    added,
    removed,
    restored,
    changed: added.length + removed.length + restored.length > 0,
  };
}

// ============ readiness score ============

export interface ScoredTask {
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
  /** not_applicable / handled_externally. null on rows predating the split. */
  dismissal?: Dismissal | null;
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
    // not_applicable leaves the score on both sides — scoring someone on a rule
    // that does not apply to them is meaningless either way. handled_externally
    // stays in and earns full credit, because the obligation IS met.
    if (!countsTowardScore(task)) continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    const weight = PRIORITY_WEIGHT[template.priority as TaskPriority];
    // in-flight work earns partial credit; waiting on a third party counts too
    const credit =
      task.status === "done" || dismissalOf(task) === "handled_externally"
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
  const taskById = new Map(tasks.map((t) => [t.template_id, t] as const));
  const open = tasks.filter(
    (t) =>
      t.is_relevant &&
      (t.status === "todo" || t.status === "in_progress") &&
      templates.has(t.template_id)
  );

  const unblocked = open.filter((t) => {
    const template = templates.get(t.template_id)!;
    const statutory = isStatutoryFiling(t.template_id);
    return template.depends_on.every((dep) =>
      // deps absent from the plan don't block (the alternative-prerequisite
      // convention); a dismissed dep blocks a statutory duty but not advice.
      satisfiesDependency(taskById.get(dep), { statutory })
    );
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
