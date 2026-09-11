/**
 * "A rule that affects you changed."
 *
 * The source watcher tells the team a page moved; the review queue tells them
 * what is stale. Neither reaches the user — so the product could correct a
 * deadline or an amount and the person whose filing depends on it would never
 * find out it had changed. That is the last gap in the regulatory-change story
 * the landing page advertises.
 *
 * Two rules shape this module, and both are about not becoming noise:
 *
 * 1. **Targeted, not broadcast.** A notice is shown only to users whose plan
 *    actually contains the task it is about. A blanket "the law changed"
 *    announcement teaches people to dismiss these, which is strictly worse than
 *    not sending them.
 *
 * 2. **Human-authored.** Entries are written after somebody reads the changed
 *    source and decides what it means. They are NOT derived from the
 *    source-watch checksum — a hash can say "look at this page", never "the law
 *    changed", and auto-publishing the latter from the former is exactly the
 *    unverified confidence this codebase spent a pass removing.
 */

export type ChangeKind = "deadline" | "amount" | "rule" | "guidance";

export interface ChangelogEntry {
  id: string;
  template_id: string;
  summary: string;
  change_kind: ChangeKind;
  source_url: string;
  effective_from: string | null;
  published_at: string;
}

/** How prominently a change is shown, and the word for it. */
export const CHANGE_LABEL: Record<ChangeKind, string> = {
  deadline: "מועד השתנה",
  amount: "סכום עודכן",
  rule: "הכלל עצמו השתנה",
  guidance: "הבהרה",
};

/**
 * Ordering weight. A moved DEADLINE outranks everything: it is the one change
 * that can make a user late through no fault of their own. A clarification that
 * does not alter the duty ranks last — it is worth knowing and not worth
 * interrupting anyone for.
 */
const KIND_RANK: Record<ChangeKind, number> = {
  deadline: 0,
  amount: 1,
  rule: 2,
  guidance: 3,
};

/** Changes a `guidance` entry alone should not raise an alarm. */
export function isConsequential(kind: ChangeKind): boolean {
  return kind !== "guidance";
}

export interface RelevantChange extends ChangelogEntry {
  /** The task's title, so the notice can name it in the user's own plan. */
  title: string;
  href: string;
}

/**
 * Filters a changelog down to what this particular business is affected by, and
 * orders it by consequence.
 *
 * `relevantTemplateIds` is the set of templates in the user's plan — including
 * ones they have completed, because a rule change on something already filed is
 * often MORE urgent than on something outstanding: a filing made under the old
 * rule may need revisiting.
 *
 * Pure, so the ordering is testable and identical wherever it is shown.
 */
export function relevantChanges(
  entries: ChangelogEntry[],
  relevantTemplateIds: Set<string>,
  titleFor: (templateId: string) => string | undefined,
  readIds: Set<string> = new Set()
): RelevantChange[] {
  return entries
    .filter((e) => relevantTemplateIds.has(e.template_id))
    .filter((e) => !readIds.has(e.id))
    // A change about a template we can no longer name would render as a notice
    // about nothing, so it is dropped rather than shown with a raw id.
    .flatMap((e) => {
      const title = titleFor(e.template_id);
      if (!title) return [];
      return [{ ...e, title, href: `/tasks/${e.template_id}` }];
    })
    .sort(
      (a, b) =>
        KIND_RANK[a.change_kind] - KIND_RANK[b.change_kind] ||
        b.published_at.localeCompare(a.published_at) ||
        a.id.localeCompare(b.id)
    );
}

/**
 * One line summarising the set, for a banner.
 *
 * Says how many and what kind, rather than a bare count — "2 changes" tells the
 * user nothing about whether to care.
 */
export function changeBannerText(changes: RelevantChange[]): string | null {
  if (changes.length === 0) return null;
  const deadlines = changes.filter((c) => c.change_kind === "deadline").length;
  if (deadlines > 0) {
    return deadlines === 1
      ? "מועד של חובה שרלוונטית לכם השתנה"
      : `${deadlines} מועדים של חובות שרלוונטיות לכם השתנו`;
  }
  const consequential = changes.filter((c) => isConsequential(c.change_kind)).length;
  if (consequential > 0) {
    return consequential === 1
      ? "כלל שרלוונטי לכם עודכן"
      : `${consequential} כללים שרלוונטיים לכם עודכנו`;
  }
  return changes.length === 1 ? "הבהרה בתוכן שרלוונטי לכם" : "הבהרות בתוכן שרלוונטי לכם";
}
