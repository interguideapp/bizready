import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, TEMPLATES_BY_ID } from "@/lib/content";
import { legalBasisOf } from "@/lib/content/legal-basis";
import { buildPlan } from "@/lib/rules-engine";
import type { EntityType, OnboardingAnswers } from "@/lib/types";

/**
 * Golden plans: the exact set of tasks each kind of business is handed.
 *
 * The applicability engine is the product's core output, and its failure mode is
 * silence — a mis-gated template simply does not appear, or appears for someone
 * it does not apply to, with nothing raising an error. The reachability
 * invariant in content/invariants.test.ts catches dependency holes; these tests
 * catch the gates themselves, by naming what each entity type must and must not
 * receive.
 *
 * They are deliberately assertions about specific ids rather than snapshots. A
 * snapshot of 40-odd ids gets re-baselined without being read; a named
 * expectation fails with a sentence explaining what broke.
 */

function answers(over: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    stage: "setting_up",
    entity_type: "osek_patur",
    field: "consulting",
    expected_revenue: "60k_to_ceiling",
    work_location: "home",
    sales_channel: "in_person",
    client_type: "private",
    product_type: "services",
    hosts_clients: false,
    collects_personal_data: false,
    uses_vehicle: false,
    has_website: false,
    plans_employees: false,
    wants_marketing: true,
    employee_work_mode: "on_site",
    already_done: [],
    ...over,
  };
}

const planFor = (over: Partial<OnboardingAnswers> = {}) =>
  new Set(buildPlan(answers(over), TASK_TEMPLATES).map((t) => t.template_id));

const ENTITIES: EntityType[] = ["osek_patur", "osek_murshe", "company", "partnership"];

describe("every entity type gets a usable plan", () => {
  it.each(ENTITIES)("%s receives a non-empty plan with at least one statute task", (entity_type) => {
    const plan = planFor({ entity_type });
    expect(plan.size).toBeGreaterThan(10);
    const statutes = [...plan].filter((id) => legalBasisOf(id) === "statute");
    expect(statutes.length).toBeGreaterThan(0);
  });

  it.each(ENTITIES)("%s: every task in the plan is a real template", (entity_type) => {
    for (const id of planFor({ entity_type })) {
      expect(TEMPLATES_BY_ID.has(id)).toBe(true);
    }
  });
});

describe("the osek track", () => {
  it("opens files as an individual, and never sees the company tasks", () => {
    const plan = planFor({ entity_type: "osek_patur" });
    expect(plan).toContain("open-vat-file");
    expect(plan).toContain("open-income-tax-file");
    expect(plan).toContain("open-bituach-leumi-file");
    for (const id of [
      "register-company",
      "company-tax-files",
      "company-bank-account",
      "company-annual-fee",
      "company-annual-report-financials",
      "register-partnership",
      "partnership-annual-fee",
    ]) {
      expect(plan).not.toContain(id);
    }
  });

  it("an עוסק פטור watches the ceiling and files no periodic VAT return", () => {
    const plan = planFor({ entity_type: "osek_patur" });
    expect(plan).toContain("patur-ceiling-watch");
    expect(plan).not.toContain("vat-reporting");
  });

  it("an עוסק מורשה files periodic VAT and does not watch the ceiling", () => {
    const plan = planFor({ entity_type: "osek_murshe" });
    expect(plan).toContain("vat-reporting");
    expect(plan).not.toContain("patur-ceiling-watch");
  });

  it("both osek types get the self-employed pension duty", () => {
    // חוק פנסיה חובה לעצמאים, 2017.
    expect(planFor({ entity_type: "osek_patur" })).toContain("mandatory-pension");
    expect(planFor({ entity_type: "osek_murshe" })).toContain("mandatory-pension");
  });
});

describe("the company track", () => {
  it("registers as a legal person and opens its tax files as one", () => {
    const plan = planFor({ entity_type: "company" });
    expect(plan).toContain("register-company");
    expect(plan).toContain("company-tax-files");
    expect(plan).toContain("company-annual-fee");
    expect(plan).toContain("company-annual-report-financials");
  });

  it("never gets the עוסק file-opening tasks", () => {
    const plan = planFor({ entity_type: "company" });
    for (const id of ["open-vat-file", "open-income-tax-file", "open-bituach-leumi-file"]) {
      expect(plan).not.toContain(id);
    }
  });

  it("is NOT told the self-employed pension law applies to it", () => {
    // The defect this pins: mandatory-pension was applies_when {} and
    // priority: critical, with a `why` reading "זו חובה חוקית מ-2017" — the
    // self-employed pension law — presented to a חברה בע"מ as a critical legal
    // duty. work-disability-insurance depended on it and inherited the error.
    const plan = planFor({ entity_type: "company" });
    expect(plan).not.toContain("mandatory-pension");
    expect(plan).not.toContain("work-disability-insurance");
  });

  it("gets the company bank account, not the sole-trader advice", () => {
    // business-bank-account's steps say, in so many words, that an
    // עוסק פטור/מורשה does not need an expensive business account — advice
    // written for a sole trader, shown to a company beside the correct task.
    const plan = planFor({ entity_type: "company" });
    expect(plan).toContain("company-bank-account");
    expect(plan).not.toContain("business-bank-account");
  });

  it("files periodic VAT (a company has no 'exempt' track)", () => {
    const plan = planFor({ entity_type: "company" });
    expect(plan).toContain("vat-reporting");
    expect(plan).not.toContain("patur-ceiling-watch");
  });

  it("reports through audited financials rather than an individual annual return", () => {
    const plan = planFor({ entity_type: "company" });
    expect(plan).toContain("company-annual-report-financials");
    expect(plan).not.toContain("annual-tax-report");
    expect(plan).not.toContain("capital-statement-prep");
  });
});

describe("the partnership track", () => {
  it("registers with the registrar and pays its annual fee", () => {
    const plan = planFor({ entity_type: "partnership" });
    expect(plan).toContain("register-partnership");
    expect(plan).toContain("partnership-annual-fee");
    expect(plan).toContain("partnership-agreement");
  });

  it("still opens files as individuals and keeps the self-employed duties", () => {
    const plan = planFor({ entity_type: "partnership" });
    expect(plan).toContain("open-vat-file");
    expect(plan).toContain("mandatory-pension");
    expect(plan).toContain("annual-tax-report");
  });

  it("gets no company tasks", () => {
    const plan = planFor({ entity_type: "partnership" });
    expect(plan).not.toContain("register-company");
    expect(plan).not.toContain("company-annual-fee");
  });
});

describe("employees", () => {
  it.each(ENTITIES)("%s with employees gets the full employer set", (entity_type) => {
    const plan = planFor({ entity_type, plans_employees: true });
    for (const id of [
      "employer-deductions-file",
      "employment-terms-notice",
      "attendance-tracking",
      "payroll-solution",
      "employee-pension-setup",
      "employee-rights-basics",
      "travel-reimbursement",
    ]) {
      expect(plan).toContain(id);
    }
  });

  it.each(ENTITIES)("%s without employees gets none of them", (entity_type) => {
    const plan = planFor({ entity_type, plans_employees: false });
    for (const id of [
      "employer-deductions-file",
      "employment-terms-notice",
      "attendance-tracking",
      "payroll-solution",
      "employee-pension-setup",
    ]) {
      expect(plan).not.toContain(id);
    }
  });
});

describe("growth work is gated by the same intent as marketing work", () => {
  const GROWTH = [
    "buy-domain",
    "build-website",
    "business-email",
    "social-profiles",
    "whatsapp-business",
    "google-business-profile",
  ];
  const MARKETING = [
    "target-audience",
    "basic-branding",
    "marketing-plan",
    "reviews-mechanism",
    "digital-business-card",
  ];

  it("a user who wants marketing help gets both clusters", () => {
    const plan = planFor({ wants_marketing: true });
    for (const id of [...GROWTH, ...MARKETING]) expect(plan).toContain(id);
  });

  it("a compliance-only user gets neither", () => {
    // The five marketing templates were already gated on wants_marketing; the
    // six growth ones were not, so someone who asked for compliance help only
    // was still handed "buy a domain" and "build a website".
    const plan = planFor({ wants_marketing: false });
    for (const id of [...GROWTH, ...MARKETING]) expect(plan).not.toContain(id);
  });

  it("turning marketing off never removes a statutory duty", () => {
    const withMarketing = planFor({ wants_marketing: true });
    const without = planFor({ wants_marketing: false });
    const lostStatutes = [...withMarketing].filter(
      (id) => !without.has(id) && legalBasisOf(id) === "statute"
    );
    expect(lostStatutes).toEqual([]);
  });
});

describe("website-dependent duties follow the website answer", () => {
  it("no website → no accessibility, statement, cookies or terms duty", () => {
    const plan = planFor({ has_website: false, collects_personal_data: false });
    for (const id of [
      "website-accessibility",
      "accessibility-statement",
      "cookies-banner",
      "website-terms",
    ]) {
      expect(plan).not.toContain(id);
    }
  });

  it("a website brings the accessibility duties (תקן 5568)", () => {
    const plan = planFor({ has_website: true });
    expect(plan).toContain("website-accessibility");
    expect(plan).toContain("accessibility-statement");
  });

  it("collecting personal data brings the privacy duties, website or not", () => {
    const plan = planFor({ has_website: false, collects_personal_data: true });
    expect(plan).toContain("privacy-policy");
    expect(plan).toContain("database-registration-check");
  });
});

describe("no plan claims a legal duty it cannot source", () => {
  it.each(ENTITIES)("%s: every statute task in the plan cites a source", (entity_type) => {
    for (const withEmployees of [false, true]) {
      for (const id of planFor({ entity_type, plans_employees: withEmployees })) {
        if (legalBasisOf(id) !== "statute") continue;
        expect(TEMPLATES_BY_ID.get(id)!.official_links.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(ENTITIES)("%s: every critical task in the plan is statute-backed", (entity_type) => {
    for (const id of planFor({ entity_type, plans_employees: true })) {
      if (TEMPLATES_BY_ID.get(id)!.priority !== "critical") continue;
      expect(legalBasisOf(id)).toBe("statute");
    }
  });
});
