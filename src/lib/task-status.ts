import type { TaskStatus } from "@/lib/types";

/**
 * What "this doesn't apply to me" means — defined once, for every engine.
 *
 * The defect this fixes: `not_relevant` collapsed two completely different
 * statements into one status, and then three engines treated that single status
 * as fully satisfying a dependency:
 *
 *   compliance.ts   `dt.status === "done" || dt.status === "not_relevant"`
 *   journey.ts      `s !== "done" && s !== "not_relevant"`
 *   rules-engine.ts `depStatus === "done" || depStatus === "not_relevant"`
 *
 * So an עוסק מורשה who dismissed "open a VAT file" as not relevant thereby
 * UNLOCKED a real, penalty-framed periodic VAT obligation — for a business with
 * no VAT file. A user's opinion that a setup step does not apply to them cannot
 * be what makes a statutory duty start counting against them.
 *
 * The two statements are now distinguished:
 *
 *   not_applicable      — "this rule isn't about me." It does NOT satisfy a
 *                         statutory prerequisite. It also excludes the task from
 *                         the readiness score entirely, numerator and
 *                         denominator, because scoring someone on a rule that
 *                         doesn't apply to them is meaningless either way.
 *
 *   handled_externally  — "this is done, just not through BizReady" (the
 *                         accountant filed it, the lawyer holds the agreement).
 *                         It DOES satisfy a prerequisite, and counts as done for
 *                         the score, because the underlying obligation is met.
 *                         It should carry evidence, like any other completion.
 *
 * Rows written before this split have `dismissal = null`. They are read as
 * `not_applicable` — the conservative reading. It never satisfies a statutory
 * prerequisite, so a legacy dismissal cannot silently keep a fabricated duty
 * running, and the user is asked to say which they meant when it matters.
 */

export type Dismissal = "not_applicable" | "handled_externally";

export const DISMISSAL_LABEL: Record<Dismissal, string> = {
  not_applicable: "לא רלוונטי לעסק שלי",
  handled_externally: "מטופל אצלי מחוץ ל-BizReady",
};

export const DISMISSAL_EXPLAINER: Record<Dismissal, string> = {
  not_applicable:
    "המשימה תוסר מהתכנית ולא תיחשב בציון המוכנות. אם היא תנאי מקדים לחובה חוקית, לא נוכל לחשב את המועדים של אותה חובה.",
  handled_externally:
    "נתייחס לזה כמבוצע: זה ייחשב בציון ויפתח את החובות שתלויות בו. שווה לצרף אסמכתא כדי שיהיה מה להראות בבדיקה.",
};

/** The one shape every engine passes in. */
export interface DismissibleTask {
  status: TaskStatus;
  is_relevant: boolean;
  /** null on rows written before the not_applicable / handled_externally split. */
  dismissal?: Dismissal | null;
}

/**
 * How a dismissed task should be read. A `not_relevant` row with no recorded
 * dismissal is read as `not_applicable`, which is the reading that claims least.
 */
export function dismissalOf(task: DismissibleTask): Dismissal | null {
  if (task.status !== "not_relevant") return null;
  return task.dismissal ?? "not_applicable";
}

export function isDismissed(task: DismissibleTask): boolean {
  return task.status === "not_relevant";
}

/**
 * Does this task satisfy something that depends on it?
 *
 * `statutory` is the whole point of the parameter. A recommended task's
 * dependency chain is advice, and "not applicable" is a perfectly good answer
 * within advice. A statutory duty is different: the product is asserting a legal
 * deadline, and it may only do that once the prerequisite is genuinely met.
 */
export function satisfiesDependency(
  task: DismissibleTask | undefined,
  opts: { statutory: boolean }
): boolean {
  // Not in the plan at all → the rule that needs it doesn't apply here either.
  // This is the "alternative prerequisite" convention (open-vat-file OR
  // company-tax-files), and it is deliberate.
  if (!task) return true;
  // Applies to nobody in this plan any more — same reasoning.
  if (!task.is_relevant) return true;
  if (task.status === "done") return true;

  const dismissal = dismissalOf(task);
  if (dismissal === "handled_externally") return true;
  if (dismissal === "not_applicable") {
    // A statutory duty stays gated. A recommendation may proceed.
    return !opts.statutory;
  }
  return false;
}

/**
 * Does this task belong in the readiness score at all?
 *
 * `not_applicable` is excluded from numerator AND denominator — it is not a
 * failure, and it is not an achievement. `handled_externally` stays in, and
 * `scoreCreditFor` gives it full credit.
 */
export function countsTowardScore(task: DismissibleTask): boolean {
  if (!task.is_relevant) return false;
  return dismissalOf(task) !== "not_applicable";
}

/** Fraction of credit a task earns in the score. */
export function scoreCreditFor(task: DismissibleTask): number {
  if (task.status === "done") return 1;
  if (dismissalOf(task) === "handled_externally") return 1;
  if (task.status === "in_progress") return 0.5;
  return 0;
}

/**
 * A dismissal the user should be asked to clarify: they set a statutory duty's
 * prerequisite aside without saying which kind of "doesn't apply" they meant, so
 * the dependent obligation is now gated and they have not been told why.
 *
 * Surfacing this is not optional. Gating the duty is the safe behaviour, but
 * silently gating it would replace a fabricated deadline with a missing one —
 * the same failure in the other direction.
 */
export function needsDismissalClarification(task: DismissibleTask): boolean {
  return task.status === "not_relevant" && (task.dismissal ?? null) === null;
}

/** Runtime guard for the dismissal value arriving from a client payload. */
export function isDismissal(value: unknown): value is Dismissal {
  return value === "not_applicable" || value === "handled_externally";
}
