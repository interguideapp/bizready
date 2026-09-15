import { ALREADY_DONE_OPTIONS } from "@/lib/content";
import { primaryArtefactOf } from "@/lib/task-evidence";
import type { OnboardingAnswers } from "@/lib/types";

/**
 * Server Actions are a public POST endpoint and TypeScript types are erased at
 * runtime, so onboarding answers must be validated rather than trusted.
 *
 * `already_done` was the dangerous one: it was accepted verbatim and fed
 * straight into buildPlan, so a crafted payload could mark vat-reporting /
 * income-tax-advances / annual-tax-report as `done` with completed_at = now.
 * That disabled the overdue alarm, made the overdue reminder path unreachable
 * for up to a full filing cycle, and awarded XP plus the "מדווחים בזמן" badge
 * for having filed nothing.
 *
 * Unknown values fall back to a safe default rather than throwing, so a stale
 * client can never lock a user out of their own plan.
 */

const ENTITY = ["osek_patur", "osek_murshe", "company", "partnership"] as const;
const STAGE = ["idea", "setting_up", "active"] as const;
const FIELD = [
  "beauty_care", "food", "consulting", "tech", "commerce",
  "professional", "creative", "construction", "other",
] as const;
const REVENUE = ["under_60k", "60k_to_ceiling", "over_ceiling"] as const;
const WORK_LOCATION = ["home", "premises", "mobile", "online_only"] as const;
const SALES_CHANNEL = ["in_person", "online", "both"] as const;
const CLIENT_TYPE = ["private", "business", "both"] as const;
const PRODUCT_TYPE = ["services", "physical_products", "digital_products", "mixed"] as const;
const EMPLOYEE_MODE = ["on_site", "remote", "field", "mixed"] as const;
const VAT_FREQUENCY = ["monthly", "bimonthly"] as const;

/** Only ids the wizard actually offers may be pre-marked as done. */
const ALREADY_DONE_IDS = new Set(ALREADY_DONE_OPTIONS.map((o) => o.id));

function oneOf<T extends readonly string[]>(
  allowed: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeAnswers(input: unknown): OnboardingAnswers {
  const a = (input ?? {}) as Record<string, unknown>;
  const entity_type = oneOf(ENTITY, a.entity_type, "osek_patur");

  return {
    stage: oneOf(STAGE, a.stage, "setting_up"),
    entity_type,
    field: oneOf(FIELD, a.field, "other"),
    expected_revenue: oneOf(REVENUE, a.expected_revenue, "under_60k"),
    work_location: oneOf(WORK_LOCATION, a.work_location, "home"),
    sales_channel: oneOf(SALES_CHANNEL, a.sales_channel, "in_person"),
    client_type: oneOf(CLIENT_TYPE, a.client_type, "private"),
    product_type: oneOf(PRODUCT_TYPE, a.product_type, "services"),
    hosts_clients: bool(a.hosts_clients),
    collects_personal_data: bool(a.collects_personal_data),
    uses_vehicle: bool(a.uses_vehicle),
    has_website: bool(a.has_website),
    plans_employees: bool(a.plans_employees),
    // documented default for accounts created before this answer existed —
    // enforced here, in the engine's own boundary, not just in the settings form
    wants_marketing: bool(a.wants_marketing, true),
    employee_work_mode: oneOf(EMPLOYEE_MODE, a.employee_work_mode, "on_site"),
    // only meaningful where VAT is reported periodically
    vat_frequency:
      entity_type === "osek_murshe" || entity_type === "company"
        ? oneOf(VAT_FREQUENCY, a.vat_frequency, "bimonthly")
        : undefined,
    already_done: Array.isArray(a.already_done)
      ? [...new Set(a.already_done.filter(
          (id): id is string => typeof id === "string" && ALREADY_DONE_IDS.has(id)
        ))]
      : [],
  };
}

/**
 * The artefacts a user typed beside the boxes they ticked in "מה כבר יש?".
 *
 * Validated the same way `already_done` is, and for the same reason: this
 * arrives at a public POST endpoint, and it ends up both in the task's
 * evidence and — for the thirteen options whose field declares a `writesTo` —
 * on the business card. Untrusted input reaching the businesses row is the
 * mass-assignment hole the audit found, so the rules are narrow:
 *
 *   - only ids the wizard offers, AND only ids actually ticked, so an artefact
 *     cannot smuggle a completion for a task that was never asserted;
 *   - only the ONE field key that template asks for first, so no caller can
 *     invent a key and have it stored as evidence;
 *   - a trimmed, length-capped string, or the entry is dropped.
 *
 * Returned keyed by template id with the field key resolved, so callers never
 * have to decide which key an answer belongs under.
 */
export function sanitizeAlreadyDoneEvidence(
  input: unknown,
  alreadyDone: string[]
): Record<string, Record<string, string>> {
  if (!input || typeof input !== "object") return {};
  const ticked = new Set(alreadyDone);
  const raw = input as Record<string, unknown>;
  const out: Record<string, Record<string, string>> = {};

  for (const [templateId, value] of Object.entries(raw)) {
    if (!ALREADY_DONE_IDS.has(templateId)) continue;
    if (!ticked.has(templateId)) continue;
    if (typeof value !== "string") continue;
    const text = value.trim().slice(0, 200);
    if (!text) continue;
    const field = primaryArtefactOf(templateId);
    if (!field) continue;
    out[templateId] = { [field.key]: text };
  }
  return out;
}

/** Business name: trimmed, non-empty, length-capped. */
export function sanitizeBusinessName(input: unknown): string {
  const name = typeof input === "string" ? input.trim() : "";
  if (!name) throw new Error("שם העסק חסר");
  return name.slice(0, 120);
}
