import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  computeUpcomingObligations,
  crossedWindows,
  nextFilingPeriod,
  recommendedDeadline,
  isStatutoryFiling,
  REMINDER_WINDOWS_PRO,
  type ComplianceTask,
} from "./compliance";

const today = new Date("2026-07-20T09:00:00Z");

function task(partial: Partial<ComplianceTask> & { template_id: string }): ComplianceTask {
  return { status: "todo", is_relevant: true, completion_data: null, ...partial };
}

describe("computeUpcomingObligations — real, period-accurate anchors", () => {
  it("anchors bimonthly VAT to the 15th after the period, with a period label + rule", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "vat-reporting" })],
      TEMPLATES_BY_ID,
      [],
      today,
      { vatFrequency: "bimonthly" }
    );
    // today 2026-07-20: May–Jun was due Jul 15 (passed) → next is Jul–Aug, due Sep 15
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe("vat");
    expect(obs[0].basis).toBe("statutory");
    expect(obs[0].dueDate).toBe("2026-09-15");
    expect(obs[0].periodLabel).toContain("יולי");
    expect(obs[0].periodLabel).toContain("אוגוסט");
    expect(obs[0].ruleText.length).toBeGreaterThan(10);
    expect(obs[0].sourceUrl).toBeTruthy();
  });

  it("anchors monthly VAT to the 15th of the following month", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "vat-reporting" })],
      TEMPLATES_BY_ID,
      [],
      today,
      { vatFrequency: "monthly" }
    );
    // June due Jul 15 (passed) → next is July, due Aug 15
    expect(obs[0].dueDate).toBe("2026-08-15");
    expect(obs[0].periodLabel).toBe("יולי 2026");
  });

  it("defaults to bimonthly when no frequency is given", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "vat-reporting" })],
      TEMPLATES_BY_ID,
      [],
      today
    );
    expect(obs[0].dueDate).toBe("2026-09-15");
  });

  it("surfaces income-tax advances at the same frequency as VAT", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "income-tax-advances" })],
      TEMPLATES_BY_ID,
      [],
      today,
      { vatFrequency: "monthly" }
    );
    expect(obs[0].kind).toBe("advances");
    expect(obs[0].dueDate).toBe("2026-08-15");
  });

  it("anchors the annual report to the next April 30", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "annual-tax-report" })],
      TEMPLATES_BY_ID,
      [],
      today
    );
    expect(obs[0].dueDate).toBe("2027-04-30");
    expect(obs[0].kind).toBe("annual_report");
    expect(obs[0].basis).toBe("statutory");
  });

  it("surfaces a document expiry as its own obligation", () => {
    const obs = computeUpcomingObligations(
      [],
      TEMPLATES_BY_ID,
      [{ name: "פוליסת אחריות מקצועית", expires_at: "2026-09-01" }],
      today
    );
    expect(obs[0].kind).toBe("document_expiry");
    expect(obs[0].basis).toBe("renewal");
    expect(obs[0].title).toContain("פוליסת אחריות מקצועית");
    expect(obs[0].daysUntil).toBe(43);
  });

  it("surfaces a yearly renewal date captured at completion", () => {
    const obs = computeUpcomingObligations(
      [
        task({
          template_id: "professional-liability-insurance",
          status: "done",
          completion_data: { renewal: "2026-08-10" },
        }),
      ],
      TEMPLATES_BY_ID,
      [],
      today
    );
    expect(obs.some((o) => o.kind === "renewal" && o.dueDate === "2026-08-10")).toBe(true);
  });

  it("returns obligations sorted by date and skips irrelevant tasks", () => {
    const obs = computeUpcomingObligations(
      [
        task({ template_id: "annual-tax-report" }),
        task({ template_id: "vat-reporting" }),
        task({ template_id: "bookkeeping", is_relevant: false }),
      ],
      TEMPLATES_BY_ID,
      [],
      today
    );
    const dates = obs.map((o) => o.dueDate);
    expect(dates).toEqual([...dates].sort());
    // routine monthly habits (bookkeeping) are NOT statutory obligations
    expect(obs.some((o) => o.templateId === "bookkeeping")).toBe(false);
  });
});

describe("nextFilingPeriod", () => {
  it("skips a period whose deadline already passed", () => {
    // 2026-07-20, bimonthly: May–Jun deadline (Jul 15) is gone → Jul–Aug (Sep 15)
    const p = nextFilingPeriod(today, "bimonthly");
    expect(p.dueIso).toBe("2026-09-15");
  });

  it("returns the current month's filing when its deadline is still ahead", () => {
    // 2026-07-05 monthly: June period due Jul 15, still ahead
    const p = nextFilingPeriod(new Date("2026-07-05T09:00:00Z"), "monthly");
    expect(p.dueIso).toBe("2026-07-15");
  });
});

describe("recommendedDeadline", () => {
  it("anchors a one-off recommendation to the registration date", () => {
    const t = TEMPLATES_BY_ID.get("open-income-tax-file")!; // deadline_days 7
    expect(recommendedDeadline(t, "2026-07-01")).toBe("2026-07-08");
  });

  it("never produces a recommended date for a statutory filing", () => {
    const t = TEMPLATES_BY_ID.get("vat-reporting")!;
    expect(recommendedDeadline(t, "2026-07-01")).toBeNull();
  });
});

describe("isStatutoryFiling", () => {
  it("marks the three penalty-bearing filings, nothing else", () => {
    expect(isStatutoryFiling("vat-reporting")).toBe(true);
    expect(isStatutoryFiling("income-tax-advances")).toBe(true);
    expect(isStatutoryFiling("annual-tax-report")).toBe(true);
    expect(isStatutoryFiling("bookkeeping")).toBe(false);
    expect(isStatutoryFiling("open-vat-file")).toBe(false);
  });
});

describe("crossedWindows", () => {
  it("returns the Pro windows that a due date has entered", () => {
    expect(crossedWindows(20, REMINDER_WINDOWS_PRO)).toEqual([30]);
    expect(crossedWindows(6, REMINDER_WINDOWS_PRO)).toEqual([30, 14, 7]);
    expect(crossedWindows(0, REMINDER_WINDOWS_PRO)).toEqual([30, 14, 7, 1]);
    expect(crossedWindows(-2, REMINDER_WINDOWS_PRO)).toEqual([]);
  });
});
