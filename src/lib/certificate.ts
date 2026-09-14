import { DEFAULT_COMPLETION, completionSpecOf } from "@/lib/types";
import type { BusinessField, CompletionField, TaskTemplate } from "@/lib/types";

/**
 * THE BUSINESS CARD AS A CERTIFICATE: everything the business has actually
 * done, with the artefact each task produced.
 *
 * The card showed eleven fields — the tax files, the bank, the accountant —
 * because those are the only things any task writes back to the `businesses`
 * row. Measured across the content: 73 templates, 33 capture an artefact on
 * completion, and only SEVEN of those reach the card. Forty capture nothing at
 * all: you tick the steps, confirm, and the fact that you did it leaves no
 * trace beyond a status.
 *
 * So a business that had opened its VAT file, registered a domain, bought
 * professional-liability cover and set up a pension could show a card with a
 * VAT number on it and no sign of the other three.
 *
 * DERIVED, NOT DUPLICATED. The artefacts are already stored — every completion
 * field lands in business_tasks.completion_data. Adding sixty columns to
 * `businesses` would create a second copy of each one and a second thing to
 * keep in step; this reads what is there. The task's own evidence is the
 * source and the certificate is a view of it, which is the same rule the rest
 * of this codebase follows for dates, statuses and counts.
 *
 * The LABELS come from the template's completion spec rather than from the
 * stored keys, so a value appears under the words the user was asked for
 * ("מספר העוסק שקיבלת") and not under a column name.
 */

/** A key written by the machine or the app, never by the user answering a field. */
function isInternalKey(key: string): boolean {
  return key.startsWith("__");
}

export interface CertificateItem {
  key: string;
  /** The question the user answered, from the completion spec. */
  label: string;
  value: string;
  type?: CompletionField["type"];
  /**
   * False when the stored key is not in the template's spec any more.
   *
   * Shown anyway, under its raw key. A spec that changed after the answer was
   * given is not a reason to hide something the business recorded — that would
   * be the certificate quietly omitting real evidence, which is the failure it
   * exists to fix.
   */
  fromSpec: boolean;
  /**
   * True when the value was read from the business row rather than from the
   * answer stored at completion time.
   *
   * Seven completion fields declare `writesTo` and are ALSO editable on the
   * business card. Reading the stored answer would put the same number on one
   * page twice from two places, and the moment the user corrected the card
   * the certificate would keep showing the old one — the exact two-sources
   * failure this file exists to avoid. The editable column wins.
   */
  live: boolean;
}

export interface CertificateEntry {
  templateId: string;
  title: string;
  categoryId: string;
  completedAt: string | null;
  items: CertificateItem[];
}

export interface Certificate {
  /** Completed tasks that produced at least one artefact, newest first. */
  entries: CertificateEntry[];
  /**
   * Completed tasks that recorded nothing.
   *
   * Surfaced rather than hidden. These are the gap — forty templates ask for
   * no evidence at all — and a certificate that silently omitted them would
   * read as complete while saying nothing about most of the work. Naming them
   * is also the honest way to show what the card still cannot prove.
   */
  captureless: { templateId: string; title: string }[];
  /** Total artefacts recorded, which is what "the card is filling up" means. */
  recorded: number;
}

export interface CertificateTask {
  template_id: string;
  status: string;
  completed_at: string | null;
  /**
   * Widened to `unknown` values on purpose. The row type declares
   * Record<string, string>, but this is jsonb: a legacy row can still hold the
   * array `__steps_done` used before migration 025, and a webhook writes the
   * object `__proposed_evidence`. Typing it as string would let those render.
   */
  completion_data?: Record<string, unknown> | null;
  is_relevant: boolean;
}

/**
 * Build the certificate from completed tasks.
 *
 * Only `done` tasks contribute: the certificate answers "what has this
 * business done", and a task in progress has not done it yet. A dismissed or
 * irrelevant task contributes nothing either — it is not an achievement.
 */
export function buildCertificate(
  tasks: CertificateTask[],
  templates: Map<string, TaskTemplate>,
  /**
   * The business row, so a field that writes to a card column shows the
   * column's current value. Optional only so a caller with no row (a test, a
   * print route that already has the values) is not forced to fake one.
   */
  business?: Partial<Record<BusinessField, string | null>> | null
): Certificate {
  const entries: CertificateEntry[] = [];
  const captureless: { templateId: string; title: string }[] = [];

  for (const task of tasks) {
    if (!task.is_relevant || task.status !== "done") continue;
    const template = templates.get(task.template_id);
    if (!template) continue;

    // completionSpecOf, not the raw field: a template with no bespoke spec
    // still asks for the DEFAULT_COMPLETION note, and reading the raw field
    // would print that answer under the label "note".
    const own = completionSpecOf(template).fields ?? [];
    const spec = new Map(own.map((f) => [f.key, f]));

    // THE QUESTION THEY WERE ACTUALLY ASKED, even after the spec changed.
    //
    // Forty templates used to have no spec of their own, so what people
    // answered for them is stored under DEFAULT_COMPLETION's `note` key. Giving
    // those templates real fields made every one of those answers an
    // unrecognised key — and the live row for business-name-check, the only
    // artefact in the database at the time, came out labelled `note`. Adding
    // the fields fixed the future and broke the past.
    //
    // So the default spec stands behind the template's own: a key the template
    // no longer asks for is still looked up there before falling back to
    // printing the key itself. Only as a fallback, never overriding — and
    // appended AFTER the own fields, which is what makes a historical answer
    // sort behind the fields asked for today (see `order` below).
    for (const f of DEFAULT_COMPLETION.fields ?? []) {
      if (!spec.has(f.key)) spec.set(f.key, f);
    }
    const data = task.completion_data ?? {};
    const items: CertificateItem[] = [];

    for (const [key, raw] of Object.entries(data)) {
      if (isInternalKey(key)) continue;
      // Only a value a person could read. An object or a blank is not an
      // artefact, and rendering "[object Object]" on a certificate is worse
      // than leaving it out.
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      if (value === "") continue;

      const field = spec.get(key);
      // A field that writes to the card reads back from the card, so the two
      // places this number appears on one page cannot disagree.
      //
      // When the column is empty the stored answer stands in. That happens for
      // a row completed before the field declared writesTo, or a write that did
      // not land — and keeping the evidence is better than dropping it. The
      // one case it reads oddly is a column the user deliberately cleared:
      // the card then shows nothing while the certificate still shows what the
      // task recorded, which is what actually happened.
      const column = field?.writesTo ? business?.[field.writesTo] : null;
      const live = typeof column === "string" && column.trim() !== "";
      items.push({
        key,
        label: field?.label ?? key,
        value: live ? (column as string).trim() : value,
        type: field?.type,
        fromSpec: Boolean(field),
        live,
      });
    }

    if (items.length === 0) {
      captureless.push({ templateId: template.id, title: template.title });
      continue;
    }

    // The order the fields were asked in — and since the map is built
    // own-fields-first, then the default's, then nothing, a value reads in
    // that order too: what this task asks for today, then an answer to the
    // generic question it used to ask, then a key nothing recognises at all.
    const order = [...spec.keys()];
    items.sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    entries.push({
      templateId: template.id,
      title: template.title,
      categoryId: template.category_id,
      completedAt: task.completed_at,
      items,
    });
  }

  // Newest first: the most recent thing the business did is the most useful
  // line to read. A missing date sorts last rather than first, so an old row
  // with no timestamp cannot displace this week's work.
  entries.sort((a, b) => {
    if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
    if (a.completedAt) return -1;
    if (b.completedAt) return 1;
    return a.title.localeCompare(b.title);
  });

  return {
    entries,
    captureless,
    recorded: entries.reduce((n, e) => n + e.items.length, 0),
  };
}
