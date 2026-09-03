import type { TaskPriority, TaskStatus, TaskTemplate } from "@/lib/types";

/**
 * The mission journey: turns the plan + its `depends_on` graph into a connected
 * path — what's done, what's available now, what's the single next best move,
 * and what's still locked (and by what). Pure & tested.
 */

export type NodeState = "done" | "next" | "available" | "locked";

export interface JourneyTask {
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
}

export interface JourneyNode {
  templateId: string;
  title: string;
  categoryId: string;
  priority: TaskPriority;
  state: NodeState;
  /** Titles of relevant dependencies not yet done (why it's locked). */
  blockedBy: string[];
  /** Template ids this task unlocks (that depend on it). */
  unlocks: string[];
}

const priorityRank: Record<TaskPriority, number> = {
  critical: 0,
  important: 1,
  recommended: 2,
};

export interface Journey {
  nodes: JourneyNode[];
  byId: Map<string, JourneyNode>;
  nextTemplateId: string | null;
}

export function buildJourney(
  tasks: JourneyTask[],
  templates: Map<string, TaskTemplate>
): Journey {
  const relevant = tasks.filter((t) => t.is_relevant && templates.has(t.template_id));
  const statusById = new Map(relevant.map((t) => [t.template_id, t.status]));
  const relevantIds = new Set(relevant.map((t) => t.template_id));

  // who does each template unlock?
  const unlocks = new Map<string, string[]>();
  for (const t of relevant) {
    const tpl = templates.get(t.template_id)!;
    for (const dep of tpl.depends_on) {
      if (!relevantIds.has(dep)) continue;
      const list = unlocks.get(dep) ?? [];
      list.push(t.template_id);
      unlocks.set(dep, list);
    }
  }

  const nodes: JourneyNode[] = relevant.map((t) => {
    const tpl = templates.get(t.template_id)!;
    const deps = tpl.depends_on.filter((d) => relevantIds.has(d));
    const unmet = deps.filter((d) => {
      const s = statusById.get(d);
      return s !== "done" && s !== "not_relevant";
    });
    const done = t.status === "done";
    const state: NodeState = done ? "done" : unmet.length > 0 ? "locked" : "available";
    return {
      templateId: t.template_id,
      title: tpl.title,
      categoryId: tpl.category_id,
      priority: tpl.priority,
      state,
      blockedBy: unmet.map((d) => templates.get(d)?.title ?? d),
      unlocks: unlocks.get(t.template_id) ?? [],
    };
  });

  // the single next best move: available (not done/locked), by priority then order
  const next = [...nodes]
    .filter((n) => n.state === "available")
    .sort((a, b) => {
      const byP = priorityRank[a.priority] - priorityRank[b.priority];
      if (byP !== 0) return byP;
      return (
        (templates.get(a.templateId)!.sort_order ?? 0) -
        (templates.get(b.templateId)!.sort_order ?? 0)
      );
    })[0];

  if (next) {
    const n = nodes.find((x) => x.templateId === next.templateId);
    if (n) n.state = "next";
  }

  return {
    nodes,
    byId: new Map(nodes.map((n) => [n.templateId, n])),
    nextTemplateId: next?.templateId ?? null,
  };
}
