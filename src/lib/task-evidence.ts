import { TEMPLATES_BY_ID } from "@/lib/content";
import { completionSpecOf } from "@/lib/types";
import type { BusinessField, CompletionField, TaskTemplate } from "@/lib/types";

/**
 * WHAT A CLOSED TASK LEAVES BEHIND — decided in one place, for all three of
 * the ways a task can be closed.
 *
 * A task reaches `done` by three different routes:
 *
 *   1. completeTask — the full flow, which asks for the template's fields.
 *   2. completeOnboarding — "מה כבר יש?" in the registration wizard.
 *   3. applyCatchUp — the same assertion, made later.
 *
 * Only the first one ever recorded anything. Measured across the content: all
 * 17 options the wizard offers close a task whose spec declares a required
 * answer, and 13 of them declare a `writesTo` that would have filled a column
 * on the business card. So a brand-new user who truthfully ticked "פתחתי תיק
 * עוסק במע״מ" landed on a card where the task read done, `dealer_number` was
 * empty, "מה חסר ל-100%?" said the number was missing, and the certificate
 * said the task had been completed with nothing recorded — four surfaces, one
 * fact, four different stories.
 *
 * Which answer belongs to which column is therefore decided here, once, from
 * the template's own spec. It used to be computed inside completeTask from a
 * SEPARATE argument the client sent — so the client chose the
 * answer-to-column mapping, and the server only checked that the column was
 * one this template may write. A caller could put the domain name into
 * `dealer_number` and the server would have stored it there.
 */

/**
 * The one answer to ask for when someone asserts a task is already done.
 *
 * The template's first required field. Derived rather than listed, so a new
 * option in the wizard cannot arrive without its artefact, and changing a
 * field in the content cannot leave a second list behind saying otherwise.
 *
 * Null when the template asks nothing required — `evidence.test.ts` asserts no
 * wizard option is in that state.
 */
export function primaryArtefactOf(
  templateId: string,
  templates: Map<string, TaskTemplate> = TEMPLATES_BY_ID
): CompletionField | null {
  const template = templates.get(templateId);
  if (!template) return null;
  const fields = completionSpecOf(template).fields ?? [];
  return fields.find((f) => f.required) ?? fields[0] ?? null;
}

/**
 * The card columns a template's answers may fill, and with which answer.
 *
 * Keyed by the template's own field keys going in, by business column coming
 * out — the spec's `writesTo` is the only thing that decides the mapping.
 * Blank and non-string answers are dropped: an empty string would erase a
 * value the user has on the card.
 */
export function cardWritesFor(
  templateId: string,
  answers: Record<string, unknown>,
  /**
   * Injectable for the same reason buildCertificate's is: in the shipped
   * content every `writesTo` column happens to be spelled exactly like its
   * field key, so mapping by the key instead of by the declaration produces
   * identical output and no test over real templates can tell the two apart.
   * A guard that cannot see the defect certifies it.
   */
  templates: Map<string, TaskTemplate> = TEMPLATES_BY_ID
): Partial<Record<BusinessField, string>> {
  const template = templates.get(templateId);
  if (!template) return {};

  const out: Partial<Record<BusinessField, string>> = {};
  for (const field of completionSpecOf(template).fields ?? []) {
    if (!field.writesTo) continue;
    const raw = answers[field.key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    out[field.writesTo] = value;
  }
  return out;
}
