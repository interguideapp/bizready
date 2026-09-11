import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { legalBasisOf } from "@/lib/content/legal-basis";
import {
  DATED_FILING_IDS,
  FILING_RULES,
  filingRuleFor,
  type FilingRule,
} from "./filing-rules";
import {
  computeUpcomingObligations,
  nextAnnualDate,
  nextMonthlyDue,
  nextStatutoryDueDate,
  type ComplianceTask,
} from "@/lib/compliance";

const task = (partial: Partial<ComplianceTask> & { template_id: string }): ComplianceTask => ({
  status: "todo",
  is_relevant: true,
  completion_data: null,
  ...partial,
});

describe("the registry itself", () => {
  it("every rule points at a real template", () => {
    const orphans = Object.keys(FILING_RULES).filter((id) => !TEMPLATES_BY_ID.has(id));
    expect(orphans).toEqual([]);
  });

  it("every rule cites an official source and records when it was verified", () => {
    // A date the product presents as law, with no source and no verification
    // date, is exactly what this pass was for.
    const bad: string[] = [];
    for (const [id, r] of Object.entries(FILING_RULES)) {
      if (!/^https:\/\/(www\.)?(gov|btl)\.(il|gov\.il)/.test(r.source)) {
        bad.push(`${id}: source ${r.source}`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.verified)) bad.push(`${id}: verified ${r.verified}`);
    }
    expect(bad).toEqual([]);
  });

  it("every dated filing is a statute task — the product may not date a suggestion", () => {
    for (const id of DATED_FILING_IDS) {
      expect(legalBasisOf(id)).toBe("statute");
    }
  });

  it("excludes on-demand obligations from the dated set", () => {
    // הצהרת הון is triggered by a demand we cannot see. Calling it overdue
    // would be a fabricated deadline.
    expect(filingRuleFor("capital-statement-prep")!.rule.anchor).toBe("on_demand");
    expect(DATED_FILING_IDS).not.toContain("capital-statement-prep");
  });

  it("annual rules carry a real calendar month and day", () => {
    for (const [id, r] of Object.entries(FILING_RULES)) {
      if (r.rule.anchor !== "annual") continue;
      expect(r.rule.month, id).toBeGreaterThanOrEqual(1);
      expect(r.rule.month, id).toBeLessThanOrEqual(12);
      expect(r.rule.day, id).toBeGreaterThanOrEqual(1);
      expect(r.rule.day, id).toBeLessThanOrEqual(31);
    }
  });
});

describe("the dates this research pass established", () => {
  // Verified 2026-09-11 against btl.gov.il and gov.il.
  const profile = { entityType: "osek_murshe" as const, vatFrequency: "bimonthly" as const };

  it("self-employed national insurance is the 22nd, NOT the 15th", () => {
    // btl.gov.il: "התשלום מתבצע ב-22 לכל חודש עבור החודש הקודם".
    // Assuming the tax authority's 15th would have been wrong every month.
    const rule = filingRuleFor("bituach-leumi-advances")!;
    expect(rule.rule).toEqual({ anchor: "monthly", day: 22 });
    const due = nextStatutoryDueDate("bituach-leumi-advances", new Date("2026-09-11"), profile);
    expect(due).toBe("2026-09-22");
  });

  it("the employer monthly deduction report (102) is the 15th", () => {
    const rule = filingRuleFor("employer-monthly-102")!;
    expect(rule.rule).toEqual({ anchor: "monthly", day: 15 });
    const due = nextStatutoryDueDate("employer-monthly-102", new Date("2026-09-11"), profile);
    expect(due).toBe("2026-09-15");
  });

  it("the two monthly filings fall a week apart, which is the trap", () => {
    const today = new Date("2026-09-01");
    const bl = nextStatutoryDueDate("bituach-leumi-advances", today, profile)!;
    const deductions = nextStatutoryDueDate("employer-monthly-102", today, profile)!;
    expect(deductions).toBe("2026-09-15");
    expect(bl).toBe("2026-09-22");
    expect(bl > deductions).toBe(true);
  });

  it("the annual withholding report (126/856) is 30 April", () => {
    expect(filingRuleFor("employer-annual-126")!.rule).toEqual({
      anchor: "annual",
      month: 4,
      day: 30,
    });
  });

  it("the registrar annual fee is anchored to 31 March", () => {
    // gov.il: the reduced fee applies until 31.3, then the regular rate. This
    // is a hard cliff, and nothing computed it before.
    for (const id of ["company-annual-fee", "partnership-annual-fee"]) {
      expect(filingRuleFor(id)!.rule).toEqual({ anchor: "annual", month: 3, day: 31 });
    }
    const due = nextStatutoryDueDate("company-annual-fee", new Date("2026-09-11"), profile);
    expect(due).toBe("2027-03-31");
  });

  it("הצהרת הון has no computable date, and says so by returning null", () => {
    expect(nextStatutoryDueDate("capital-statement-prep", new Date("2026-09-11"), profile)).toBeNull();
  });

  it("a template with no rule returns null rather than a guessed date", () => {
    expect(nextStatutoryDueDate("choose-accountant", new Date("2026-09-11"), profile)).toBeNull();
  });
});

describe("nextMonthlyDue", () => {
  it("rolls to next month once the day has passed", () => {
    expect(nextMonthlyDue(new Date("2026-09-14"), 15).dueIso).toBe("2026-09-15");
    expect(nextMonthlyDue(new Date("2026-09-15"), 15).dueIso).toBe("2026-09-15"); // due today
    expect(nextMonthlyDue(new Date("2026-09-16"), 15).dueIso).toBe("2026-10-15");
  });

  it("crosses the year boundary", () => {
    expect(nextMonthlyDue(new Date("2026-12-20"), 15).dueIso).toBe("2027-01-15");
  });

  it("reports the period as the month BEFORE the deadline", () => {
    const { dueIso, periodAbs } = nextMonthlyDue(new Date("2026-09-10"), 15);
    expect(dueIso).toBe("2026-09-15");
    // September's deadline covers August
    expect(periodAbs).toBe(2026 * 12 + 7);
  });
});

describe("nextAnnualDate", () => {
  it("returns this year while the date is still ahead, next year once past", () => {
    expect(nextAnnualDate(new Date("2026-01-05"), 3, 31)).toBe("2026-03-31");
    expect(nextAnnualDate(new Date("2026-03-31"), 3, 31)).toBe("2026-03-31");
    expect(nextAnnualDate(new Date("2026-04-01"), 3, 31)).toBe("2027-03-31");
  });
});

describe("every explanation agrees with its own date", () => {
  // The defect this guards: the VAT rule text promised "מקוון — עד ה-19" beside
  // a date computed for the 15th, and the annual-report text said "עד סוף מאי"
  // beside 30 April. An explanation that contradicts its date is worse than
  // none, because the product's whole claim is that the reasoning is visible.
  const today = new Date("2026-09-11");

  function obligationsFor(templateId: string, entityType: "osek_murshe" | "company") {
    return computeUpcomingObligations(
      [
        task({ template_id: "open-vat-file", status: "done" }),
        task({ template_id: "open-income-tax-file", status: "done" }),
        task({ template_id: "open-bituach-leumi-file", status: "done" }),
        task({ template_id: "company-tax-files", status: "done" }),
        task({ template_id: "employer-deductions-file", status: "done" }),
        task({ template_id: "employer-monthly-102", status: "done" }),
        task({ template_id: templateId }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType, vatFrequency: "bimonthly" },
      400
    ).filter((o) => o.templateId === templateId);
  }

  it.each(DATED_FILING_IDS)("%s states the date it computed", (templateId) => {
    const entity = templateId.startsWith("company-") ? "company" : "osek_murshe";
    const [obligation] = obligationsFor(templateId, entity as "company" | "osek_murshe");
    if (!obligation) return; // not applicable to this probe profile
    const day = Number(obligation.dueDate.slice(8, 10));
    // the explanation must contain the day number of the date it explains
    expect(obligation.ruleText).toContain(String(day));
    expect(obligation.ruleText.length).toBeGreaterThan(20);
    expect(obligation.sourceUrl).toBeTruthy();
  });

  it("no explanation promises a date later than the one shown", () => {
    // "עד סוף מאי" beside 30 April was exactly this bug.
    for (const templateId of DATED_FILING_IDS) {
      const entity = templateId.startsWith("company-") ? "company" : "osek_murshe";
      const [obligation] = obligationsFor(templateId, entity as "company" | "osek_murshe");
      if (!obligation) continue;
      expect(obligation.ruleText).not.toContain("סוף מאי");
      expect(obligation.ruleText).not.toContain("ה-19");
    }
  });
});

describe("the new filings reach the people they apply to", () => {
  const today = new Date("2026-09-11");

  it("a self-employed person gets the national-insurance advance", () => {
    const obligations = computeUpcomingObligations(
      [
        task({ template_id: "open-vat-file", status: "done" }),
        task({ template_id: "open-bituach-leumi-file", status: "done" }),
        task({ template_id: "bituach-leumi-advances" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "osek_murshe", vatFrequency: "bimonthly" }
    );
    expect(obligations.some((o) => o.templateId === "bituach-leumi-advances")).toBe(true);
  });

  it("it stays gated until the ביטוח לאומי file is actually open", () => {
    // The honest-deadline principle: you owe no advance before you are
    // registered, so no date is asserted.
    const obligations = computeUpcomingObligations(
      [
        task({ template_id: "open-bituach-leumi-file", status: "todo" }),
        task({ template_id: "bituach-leumi-advances" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "osek_murshe", vatFrequency: "bimonthly" }
    );
    expect(obligations.some((o) => o.templateId === "bituach-leumi-advances")).toBe(false);
  });

  it("the monthly 102 waits for the ניכויים file", () => {
    const gated = computeUpcomingObligations(
      [
        task({ template_id: "employer-deductions-file", status: "todo" }),
        task({ template_id: "employer-monthly-102" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "osek_murshe" }
    );
    expect(gated.some((o) => o.templateId === "employer-monthly-102")).toBe(false);

    const open = computeUpcomingObligations(
      [
        task({ template_id: "employer-deductions-file", status: "done" }),
        task({ template_id: "employer-monthly-102" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "osek_murshe" }
    );
    expect(open.some((o) => o.templateId === "employer-monthly-102")).toBe(true);
  });
});

describe("the rules a source could not be found for stay out", () => {
  it("does not invent a date for a company annual return", () => {
    // One of the largest penalty exposures, and the audit is right that it has
    // no anchored date. The filing runs through the רשות המסים "הסדר"
    // arrangement with representative-dependent extensions, so any single date
    // would be a guess dressed as a rule. Better absent than fabricated.
    expect(filingRuleFor("company-annual-report-financials")).toBeNull();
  });

  it("does not invent a withholding-certificate renewal date", () => {
    expect(filingRuleFor("withholding-certificate")).toBeNull();
  });
});
