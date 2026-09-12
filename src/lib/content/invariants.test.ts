import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, TEMPLATES_BY_ID, CATEGORIES_BY_ID } from "@/lib/content";
import { ARCHETYPE_BY_ID } from "@/lib/content/archetypes";
import { filingRuleFor } from "@/lib/content/filing-rules";
import { LEGAL_BASIS } from "@/lib/content/legal-basis";
import { buildPlan } from "@/lib/rules-engine";
import { ANSWER_ORDER } from "@/lib/types";
import type { AppliesWhen, OnboardingAnswers } from "@/lib/types";

/**
 * Build-time invariants on the content set.
 *
 * The applicability engine indexes `answers` with an untyped string key, so a
 * typo in `applies_when` silently removes a template from EVERY plan with no
 * error. And because an absent dependency is treated as "satisfied" by all
 * three engines (journey, compliance, nextSteps), a template can ship with a
 * prerequisite that is never present in the plans where it applies — which
 * means it unlocks with no prerequisite at all.
 *
 * The legal-basis tests are the other half: the product may not call something
 * a legal duty without naming the authority that says so.
 */

const ANSWER_KEYS: (keyof OnboardingAnswers)[] = [
  "stage", "entity_type", "field", "expected_revenue", "work_location",
  "sales_channel", "client_type", "product_type", "hosts_clients",
  "collects_personal_data", "uses_vehicle", "has_website", "plans_employees",
  "wants_marketing", "employee_work_mode", "vat_frequency", "already_done",
];

const ENTITIES = ["osek_patur", "osek_murshe", "company", "partnership"] as const;
const FIELDS = [
  "beauty_care", "food", "consulting", "tech", "commerce",
  "professional", "creative", "construction", "other",
] as const;

/** A representative spread of real businesses. */
function answerMatrix(): OnboardingAnswers[] {
  const out: OnboardingAnswers[] = [];
  for (const entity_type of ENTITIES) {
    for (const field of FIELDS) {
      for (const plans_employees of [false, true]) {
        for (const has_website of [false, true]) {
          out.push({
            stage: "setting_up",
            entity_type,
            field,
            expected_revenue: "60k_to_ceiling",
            work_location: "home",
            sales_channel: "in_person",
            client_type: "private",
            product_type: "services",
            hosts_clients: false,
            collects_personal_data: has_website,
            uses_vehicle: false,
            has_website,
            plans_employees,
            wants_marketing: true,
            employee_work_mode: "on_site",
            vat_frequency:
              entity_type === "osek_murshe" || entity_type === "company" ? "bimonthly" : undefined,
            already_done: [],
          });
        }
      }
    }
  }
  return out;
}

/**
 * Every answer key a predicate reads, including the ones nested inside
 * not/any/all/atLeast/atMost. A validator that only looked at the top level
 * would wave through `{ not: { entity_typo: [...] } }`, which is precisely the
 * silent-disappearance bug this test exists to prevent.
 */
function keysUsed(predicate: AppliesWhen): string[] {
  if ("not" in predicate) return keysUsed(predicate.not);
  if ("any" in predicate) return predicate.any.flatMap(keysUsed);
  if ("all" in predicate) return predicate.all.flatMap(keysUsed);
  if ("atLeast" in predicate) return Object.keys(predicate.atLeast);
  if ("atMost" in predicate) return Object.keys(predicate.atMost);
  return Object.keys(predicate);
}

/** Threshold keys must additionally have a declared order to compare against. */
function thresholdKeysUsed(predicate: AppliesWhen): string[] {
  if ("not" in predicate) return thresholdKeysUsed(predicate.not);
  if ("any" in predicate) return predicate.any.flatMap(thresholdKeysUsed);
  if ("all" in predicate) return predicate.all.flatMap(thresholdKeysUsed);
  if ("atLeast" in predicate) return Object.keys(predicate.atLeast);
  if ("atMost" in predicate) return Object.keys(predicate.atMost);
  return [];
}

describe("content invariants", () => {
  it("every applies_when key is a real onboarding answer, at every nesting level", () => {
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      for (const key of keysUsed(t.applies_when)) {
        if (!ANSWER_KEYS.includes(key as keyof OnboardingAnswers)) {
          bad.push(`${t.id}: ${key}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("every atLeast/atMost key has a declared answer order", () => {
    // Without an entry in ANSWER_ORDER the comparison has no meaning, and
    // compareOrdered returns false — quietly removing the template.
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      for (const key of thresholdKeysUsed(t.applies_when)) {
        if (!(key in ANSWER_ORDER)) bad.push(`${t.id}: ${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every depends_on id resolves to a real template", () => {
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      for (const dep of t.depends_on) {
        if (!TEMPLATES_BY_ID.has(dep)) bad.push(`${t.id} -> ${dep}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every category_id resolves to a real category", () => {
    const bad = TASK_TEMPLATES
      .filter((t) => !CATEGORIES_BY_ID.has(t.category_id))
      .map((t) => `${t.id}: ${t.category_id}`);
    expect(bad).toEqual([]);
  });

  it("template ids are unique", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const t of TASK_TEMPLATES) {
      if (seen.has(t.id)) dupes.push(t.id);
      seen.add(t.id);
    }
    expect(dupes).toEqual([]);
  });

  it("every template has an archetype (no silent fallback to 'routine')", () => {
    // A missing entry falls back to "routine" — "set up an ongoing habit" —
    // which renders a statutory filing as a recurring chore.
    const missing = TASK_TEMPLATES.filter((t) => !ARCHETYPE_BY_ID[t.id]).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it("no applicable template is left with ALL of its prerequisites absent", () => {
    // An absent dependency counts as satisfied (deliberately — it is how the
    // "alternative prerequisite" pattern works, e.g. vat-reporting depends on
    // open-vat-file OR company-tax-files). But if NONE of a template's
    // prerequisites exist in a plan, it unlocks with no gate whatsoever.
    const failures = new Set<string>();
    for (const answers of answerMatrix()) {
      const ids = new Set(buildPlan(answers, TASK_TEMPLATES).map((t) => t.template_id));
      for (const id of ids) {
        const tpl = TEMPLATES_BY_ID.get(id)!;
        if (tpl.depends_on.length === 0) continue;
        if (!tpl.depends_on.some((d) => ids.has(d))) {
          failures.add(`${id} (deps: ${tpl.depends_on.join(", ")}) for ${answers.entity_type}`);
        }
      }
    }
    expect([...failures].sort()).toEqual([]);
  });

  // ---------------------------------------------------------- legal basis --

  it("every template declares a legal basis", () => {
    // legalBasisOf() falls back to best_practice so nothing crashes, but a
    // template whose basis was never considered must not ship.
    const missing = TASK_TEMPLATES.filter((t) => !LEGAL_BASIS[t.id]).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it("LEGAL_BASIS has no entries for templates that no longer exist", () => {
    const orphans = Object.keys(LEGAL_BASIS).filter((id) => !TEMPLATES_BY_ID.has(id));
    expect(orphans).toEqual([]);
  });

  it("only a statute-backed task may be priority: critical", () => {
    // This is the invariant that gives "critical" its meaning. It is what
    // demoted pricing, google-business-profile and three insurance products,
    // none of which any law requires.
    const bad = TASK_TEMPLATES
      .filter((t) => t.priority === "critical" && LEGAL_BASIS[t.id] !== "statute")
      .map((t) => `${t.id} (${LEGAL_BASIS[t.id]})`);
    expect(bad).toEqual([]);
  });

  it("every statute task cites at least one official source", () => {
    // The product may not tell a business owner "the law requires this" without
    // showing which authority says so.
    const bad = TASK_TEMPLATES
      .filter((t) => LEGAL_BASIS[t.id] === "statute" && t.official_links.length === 0)
      .map((t) => t.id);
    expect(bad).toEqual([]);
  });

  it("a task that tells the user it expires gives them somewhere to say when", () => {
    // The renewal cycle is anchored to the date on the document (cycles.ts).
    // Without a place to record it, the cycle falls back to a year after the
    // task was ticked — so אישור ניכוי מס במקור, which the content itself says
    // lapses at the end of March, was renewed in November and next reminded the
    // following November: eight months uncovered, with no error anywhere.
    //
    // Insurance, licences and certificates are the shapes this applies to. A
    // statutory filing is excluded: its date comes from filing-rules.ts, which
    // is the authority, and a user-entered date must never override statute.
    const EXPIRY_TALK = /חידוש|לפוג|פג תוקף|תוקף האישור|תוקף התעודה|מתחדש/;
    const bad = TASK_TEMPLATES.filter((t) => {
      if (filingRuleFor(t.id)) return false;
      const prose = [t.after_submit ?? "", t.steps, ...(t.pitfalls ?? [])].join(" ");
      if (!EXPIRY_TALK.test(prose)) return false;
      return !t.completion?.fields?.some((f) => f.key === "renewal");
    }).map((t) => t.id);
    expect(bad).toEqual([]);

  });
  it("every statute task records when it was last reviewed", () => {
    const bad = TASK_TEMPLATES
      .filter((t) => LEGAL_BASIS[t.id] === "statute")
      .filter((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t.last_reviewed))
      .map((t) => `${t.id}: ${t.last_reviewed}`);
    expect(bad).toEqual([]);
  });
});
