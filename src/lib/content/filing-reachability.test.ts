import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/rules-engine";
import { TASK_TEMPLATES } from "@/lib/content";
import { DATED_FILING_IDS, FILING_RULES } from "@/lib/content/filing-rules";
import type { EntityType, OnboardingAnswers } from "@/lib/types";

/**
 * EVERY DATED OBLIGATION MUST BE REACHABLE BY SOME REAL BUSINESS.
 *
 * filing-rules.test.ts already asserts no rule is an ORPHAN — every rule id
 * has a template. That is a weaker property than it looks: a template can
 * exist, be perfectly written, and still never appear in a single plan,
 * because its applies_when is gated on a key that is never set or a value that
 * cannot occur. The rule would then be correct, tested, and invisible.
 *
 * That is the purest form of the thing this product exists to prevent. A bug
 * in a date is visible the first time someone reads it; an obligation the
 * engine never raises is visible only when the penalty arrives.
 *
 * So this enumerates the answer space that actually decides applicability —
 * entity type, whether there are employees, and the stage — and asserts that
 * each dated filing lands in at least one plan.
 */
const ENTITIES: EntityType[] = ["osek_patur", "osek_murshe", "company", "partnership"];

function answers(over: Partial<OnboardingAnswers>): OnboardingAnswers {
  return {
    stage: "setting_up",
    entity_type: "osek_murshe",
    field: "consulting",
    expected_revenue: "60k_to_ceiling",
    work_location: "home",
    sales_channel: "online",
    client_type: "business",
    product_type: "services",
    hosts_clients: false,
    collects_personal_data: false,
    uses_vehicle: false,
    has_website: false,
    plans_employees: false,
    wants_marketing: false,
    employee_work_mode: "on_site",
    already_done: [],
    ...over,
  };
}

/** Every plan a combination of the applicability-deciding answers produces. */
function allPlans(): { label: string; ids: Set<string> }[] {
  const out: { label: string; ids: Set<string> }[] = [];
  for (const entity_type of ENTITIES) {
    for (const plans_employees of [false, true]) {
      for (const stage of ["setting_up", "active"] as const) {
        const plan = buildPlan(
          answers({ entity_type, plans_employees, stage }),
          TASK_TEMPLATES,
          new Date("2026-09-14T09:00:00Z")
        );
        out.push({
          label: `${entity_type}/${plans_employees ? "employees" : "no-employees"}/${stage}`,
          ids: new Set(plan.map((p) => p.template_id)),
        });
      }
    }
  }
  return out;
}

describe("every dated filing reaches a plan", () => {
  const plans = allPlans();

  it("the premise: the enumeration really does produce different plans", () => {
    // If every combination produced the same set, reachability would be
    // trivially satisfied and prove nothing about the gating.
    const sizes = new Set(plans.map((p) => p.ids.size));
    expect(sizes.size).toBeGreaterThan(1);
    expect(plans.length).toBe(ENTITIES.length * 2 * 2);
  });

  it("every rule in the registry is reachable by at least one business", () => {
    const unreachable = Object.keys(FILING_RULES).filter(
      (id) => !plans.some((p) => p.ids.has(id))
    );
    expect(unreachable).toEqual([]);
  });

  it("and so is every DATED one, which is the set the board renders", () => {
    const unreachable = DATED_FILING_IDS.filter((id) => !plans.some((p) => p.ids.has(id)));
    expect(unreachable).toEqual([]);
  });
});

describe("the employer filings depend on there being employees", () => {
  /**
   * Reachability alone would be satisfied by a rule that applies to everyone,
   * which would be a different defect: telling a sole trader with no staff
   * that a monthly deductions return is due. So the gate is asserted in both
   * directions for the filings whose whole trigger is employment.
   */
  const plans = allPlans();
  const EMPLOYER_FILINGS = Object.keys(FILING_RULES).filter((id) => id.startsWith("employer-"));

  it("the premise: there are employer filings to check", () => {
    expect(EMPLOYER_FILINGS.length).toBeGreaterThan(0);
  });

  it("appear for a business with employees", () => {
    const withStaff = plans.filter((p) => p.label.includes("/employees/"));
    for (const id of EMPLOYER_FILINGS) {
      expect(withStaff.some((p) => p.ids.has(id)), id).toBe(true);
    }
  });

  it("never appear for a business with none", () => {
    const withoutStaff = plans.filter((p) => p.label.includes("/no-employees/"));
    for (const id of EMPLOYER_FILINGS) {
      const wrongly = withoutStaff.filter((p) => p.ids.has(id)).map((p) => p.label);
      expect(wrongly, id).toEqual([]);
    }
  });
});
