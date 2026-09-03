import type { TaskPriority } from "@/lib/types";
import { isStatutoryFiling } from "@/lib/compliance";
import type { JourneyNode } from "@/lib/journey";

/**
 * What actually deserves attention — combining real deadlines (obligations) AND
 * the open tasks themselves, weighed by importance, urgency and how much they
 * unblock. Fixes the old behaviour where "what needs you now" only looked at the
 * nearest statutory date and "next move" sorted by list order. Pure & tested.
 */

const PRIORITY_SCORE: Record<TaskPriority, number> = {
  critical: 300,
  important: 170,
  recommended: 70,
};

/**
 * The business lifecycle stage dominates raw priority: you register and open the
 * business (setup) before tax/privacy obligations (operating), and both before a
 * website or marketing (growth). Without this a "critical" website outranks the
 * actual registration. The gap is wide enough that a setup task always leads a
 * growth task of equal priority, but narrow enough that a real overdue statutory
 * filing (which also carries the statutory + overdue bonuses) still wins.
 */
export type Stage = "setup" | "operating" | "growth";
const STAGE_WEIGHT: Record<Stage, number> = {
  setup: 400,
  operating: 150,
  growth: 0,
};
export const STAGE_RANK: Record<Stage, number> = { setup: 0, operating: 1, growth: 2 };

export interface AttentionObligation {
  templateId: string | null;
  title: string;
  dueDate: string;
  daysUntil: number;
  basis: "statutory" | "renewal";
  periodLabel: string | null;
}

/** Urgency of a dated obligation — overdue and imminent dominate. */
export function obligationUrgency(o: AttentionObligation): number {
  const weight = o.basis === "statutory" ? 1.4 : 1;
  if (o.daysUntil < 0) return (900 + Math.min(300, -o.daysUntil * 8)) * weight; // overdue
  if (o.daysUntil <= 45) return (700 - o.daysUntil * 12) * weight; // approaching
  return 0; // not yet urgent
}

/** Importance of an open task node (0 for done/locked — you can't act on it). */
export function taskImportance(
  node: JourneyNode,
  dueDate: string | null,
  today: string,
  stage?: Stage
): number {
  if (node.state === "done" || node.state === "locked") return 0;
  let s = PRIORITY_SCORE[node.priority];
  if (stage) s += STAGE_WEIGHT[stage];
  if (isStatutoryFiling(node.templateId)) s += 220;
  s += node.unlocks.length * 30; // unblocking others matters
  if (dueDate && dueDate < today) {
    s += isStatutoryFiling(node.templateId) ? 500 : node.priority === "critical" ? 120 : 30;
  }
  return s;
}

export interface Attention {
  urgent:
    | { templateId: string | null; title: string; dueDate: string; daysUntil: number; periodLabel: string | null }
    | null;
  nextTemplateId: string | null;
}

/**
 * Picks the single most pressing dated item (or null if nothing is urgent yet)
 * and the single most important *available* task to advance next — never the
 * same item twice.
 */
export function computeAttention(
  obligations: AttentionObligation[],
  nodes: JourneyNode[],
  dueByTemplate: Map<string, string | null>,
  today: string,
  stageOf?: (categoryId: string) => Stage
): Attention {
  // urgent = the highest-urgency dated obligation, only if it's actually urgent
  const rankedOb = obligations
    .map((o) => ({ o, u: obligationUrgency(o) }))
    .filter((x) => x.u > 0)
    .sort((a, b) => b.u - a.u);
  const urgent = rankedOb[0]?.o ?? null;

  // next best = the most important available task, excluding whatever is urgent
  const urgentTpl = urgent?.templateId ?? null;
  const rankedTasks = nodes
    .map((n) => ({
      n,
      s: taskImportance(n, dueByTemplate.get(n.templateId) ?? null, today, stageOf?.(n.categoryId)),
    }))
    .filter((x) => x.s > 0 && x.n.templateId !== urgentTpl)
    .sort((a, b) => b.s - a.s);

  return {
    urgent: urgent
      ? {
          templateId: urgent.templateId,
          title: urgent.title,
          dueDate: urgent.dueDate,
          daysUntil: urgent.daysUntil,
          periodLabel: urgent.periodLabel,
        }
      : null,
    nextTemplateId: rankedTasks[0]?.n.templateId ?? null,
  };
}
