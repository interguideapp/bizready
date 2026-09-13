import { isStatutoryFiling } from "@/lib/compliance";
import type { TaskTemplate } from "@/lib/types";

/**
 * "What does the business already have?" — asked again, at any time.
 *
 * Onboarding asks this once, from a curated list of eighteen ALREADY_DONE
 * options, and `already_done` is then read exactly once: at plan-build time in
 * rules-engine. After that there is no catch-up pass at all. A business that
 * existed before signing up, or an owner who spent three months getting things
 * done without opening the app, had to walk the plan task by task — and the
 * product's own readiness score, exposure ranking and alerts were all computed
 * from a picture it knew was stale.
 *
 * This is the same question over the ACTUAL plan rather than a curated subset,
 * so it covers whatever is genuinely open for this business.
 *
 * WHAT IT MAY NOT OFFER, and this is the whole safety property: a statutory
 * filing can never be ticked here. The audit was explicit — "never allow a
 * client to set a statutory filing done without the evidence flow" — because a
 * crafted payload marking vat-reporting done silences the overdue alarm, earns
 * the "מדווחים בזמן" badge and makes the penalty-bearing reminder path
 * unreachable, all for a filing nobody made. Those keep their own completion
 * flow, which captures evidence into the audit trail. This offers the setup and
 * housekeeping work, which is where the catch-up backlog actually is.
 */

/** What the user can say about one open task. */
export type CatchUpMark = "done" | "handled_externally";

export interface CatchUpItem {
  templateId: string;
  title: string;
  categoryId: string;
  /** Statutory filings are excluded entirely; this is everything else open. */
  priority: TaskTemplate["priority"];
}

export interface CatchUpTask {
  template_id: string;
  status: string;
  is_relevant: boolean;
  /**
   * Optional, and only looksLikeCatchUpNeeded reads it: a task closed once and
   * reopened by its own recurrence still carries the timestamp, which is the
   * projection-proof way to ask "has this owner ever closed anything".
   */
  completed_at?: string | null;
}

/** Statutory filings, listed so a screen can say WHY they are absent. */
export function statutoryHeldBack(
  tasks: CatchUpTask[],
  templates: Map<string, TaskTemplate>
): CatchUpItem[] {
  return tasks
    .filter((t) => t.is_relevant && t.status !== "done" && isStatutoryFiling(t.template_id))
    .map((t) => itemOf(t.template_id, templates))
    .filter((i): i is CatchUpItem => i !== null);
}

function itemOf(
  templateId: string,
  templates: Map<string, TaskTemplate>
): CatchUpItem | null {
  const tpl = templates.get(templateId);
  if (!tpl) return null;
  return {
    templateId,
    title: tpl.title,
    categoryId: tpl.category_id,
    priority: tpl.priority,
  };
}

/**
 * Everything the questionnaire may offer, in plan order.
 *
 * Open and relevant only: a task already done needs no catch-up, and one the
 * user dismissed was a deliberate decision this must not quietly reverse.
 */
export function catchUpItems(
  tasks: CatchUpTask[],
  templates: Map<string, TaskTemplate>
): CatchUpItem[] {
  return tasks
    .filter(
      (t) =>
        t.is_relevant &&
        t.status !== "done" &&
        t.status !== "not_relevant" &&
        !isStatutoryFiling(t.template_id)
    )
    .map((t) => itemOf(t.template_id, templates))
    .filter((i): i is CatchUpItem => i !== null);
}

/**
 * Which of the submitted marks may actually be applied.
 *
 * Runs on the server over the business's own plan, because a Server Action is
 * a public POST endpoint and the ids arrive from the browser. Anything not
 * currently offerable is dropped rather than rejected wholesale: a plan that
 * changed in another tab must not make the whole submission fail.
 */
export function acceptableMarks(
  submitted: { templateId: string; mark: CatchUpMark }[],
  tasks: CatchUpTask[],
  templates: Map<string, TaskTemplate>
): { templateId: string; mark: CatchUpMark }[] {
  const offerable = new Set(catchUpItems(tasks, templates).map((i) => i.templateId));
  const seen = new Set<string>();
  return submitted.filter((m) => {
    if (!offerable.has(m.templateId)) return false;
    if (m.mark !== "done" && m.mark !== "handled_externally") return false;
    // One decision per task, first wins, so a duplicated id cannot produce two
    // conflicting writes in one submission.
    if (seen.has(m.templateId)) return false;
    seen.add(m.templateId);
    return true;
  });
}

/**
 * Does this business look like it needs a catch-up pass?
 *
 * The questionnaire exists, and it is linked from settings and from
 * /plan-ready. Neither is a place someone returns to, so an owner who signed
 * up months ago will not find it — and the product can usually TELL, which
 * makes staying quiet a choice rather than a limitation.
 *
 * The signal is deliberately narrow: the owner said the business is already
 * ACTIVE, and not one task has ever been closed. For a business genuinely
 * trading, having done none of its own setup work is not plausible — far more
 * likely the work happened and was never recorded, which means the readiness
 * score, the exposure ranking and every alert are being computed from a
 * picture the product has reason to doubt.
 *
 * Why not "many open tasks": a new business has many open tasks too, and that
 * is the normal state this product is built for. Nudging on that would fire
 * for everyone and become wallpaper — the failure mode every notice in this
 * codebase is written to avoid.
 *
 * Why not "signed up a while ago": someone can deliberate for months without
 * their plan being wrong. Elapsed time says nothing about accuracy.
 *
 * It is phrased as a QUESTION wherever it is shown, because the inference can
 * be wrong: a genuinely new owner who described themselves as active has done
 * nothing yet, and telling them their records are stale would be false.
 *
 * MUST BE GIVEN STORED TASKS, not the cycle-projected ones.
 *
 * projectCycles rewrites a reopened task to status "todo" AND completed_at
 * null, which is right for every screen that asks "what is open now" and wrong
 * for the only question this asks: has this owner EVER closed anything. Fed the
 * projected list, a business whose single closed task was a recurring one that
 * has since reopened reads as never having engaged, and gets asked on every
 * home visit despite keeping its plan current. getBusinessTasks is React-cached,
 * so the stored set costs nothing extra on a page that already loaded it.
 */
export function looksLikeCatchUpNeeded(args: {
  stage: string | undefined;
  /** STORED tasks. See the note above about projectCycles. */
  tasks: CatchUpTask[];
  templates: Map<string, TaskTemplate>;
}): boolean {
  if (args.stage !== "active") return false;
  // Any close at all — done, dismissed as handled elsewhere, or a completion
  // timestamp from a recurring task that has since come round again — means
  // the owner has engaged with the plan and is keeping it current.
  const everClosed = args.tasks.some(
    (t) => t.status === "done" || t.status === "not_relevant" || Boolean(t.completed_at)
  );
  if (everClosed) return false;
  // And there has to be something the questionnaire could actually take.
  return catchUpItems(args.tasks, args.templates).length > 0;
}

/**
 * Split the questionnaire into "commonly already handled" and the rest.
 *
 * Measured against the live data before building this: the two real businesses
 * would each be offered THIRTY-NINE and FORTY rows, two buttons apiece — about
 * eighty targets on one page. Grouping by category helps the list read like the
 * plan, and does nothing about its length.
 *
 * The split reuses ALREADY_DONE_OPTIONS, the eighteen options onboarding
 * already asks about, rather than inventing a ranking. That list IS the
 * curated answer to "what does a business usually already have" — a domain, a
 * website, an accountant, a separate bank account, invoicing software, a
 * pension deposit — and it was written for exactly this question, just at a
 * different moment.
 *
 * Its `entities` gating is respected, so a company is not offered the
 * individual עוסק registration, which is the same reason the onboarding step
 * filters it.
 *
 * Nothing is hidden: the rest follows, grouped as before. This only puts the
 * high-yield rows where they are read first, which is the difference between a
 * questionnaire someone finishes and one they abandon.
 */
export function splitByLikelihood(
  items: CatchUpItem[],
  commonIds: Set<string>
): { likely: CatchUpItem[]; rest: CatchUpItem[] } {
  return {
    likely: items.filter((i) => commonIds.has(i.templateId)),
    rest: items.filter((i) => !commonIds.has(i.templateId)),
  };
}

/**
 * The commonly-already-handled ids that apply to this legal structure.
 *
 * Takes the options rather than importing them, because lib/content is a heavy
 * module and this file is imported by the home screen's predicate.
 */
export function commonlyDoneIds(
  options: { id: string; entities?: string[] }[],
  entityType: string | undefined
): Set<string> {
  return new Set(
    options
      .filter((o) => !o.entities || (entityType ? o.entities.includes(entityType) : false))
      .map((o) => o.id)
  );
}
