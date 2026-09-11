import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  computeUpcomingObligations,
  crossedWindows,
  nextFilingPeriod,
  recommendedDeadline,
  isStatutoryFiling,
  filingsBlockedByDismissal,
  filingsAwaitingPrerequisite,
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

describe("company VAT waits for the company's own tax files (one truth)", () => {
  it("suppresses a company's VAT obligation until company-tax-files is done", () => {
    // company registered but tax files not yet opened → no VAT duty exists yet
    const notYet = computeUpcomingObligations(
      [
        task({ template_id: "register-company", status: "done" }),
        task({ template_id: "company-tax-files", status: "todo" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "company", vatFrequency: "bimonthly" }
    );
    expect(notYet.some((o) => o.kind === "vat")).toBe(false);

    // once the company's tax files are open, the VAT obligation appears
    const now = computeUpcomingObligations(
      [
        task({ template_id: "register-company", status: "done" }),
        task({ template_id: "company-tax-files", status: "done" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      { entityType: "company", vatFrequency: "bimonthly" }
    );
    expect(now.some((o) => o.kind === "vat")).toBe(true);
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

describe("a dismissal cannot start a statutory duty running", () => {
  // The defect: not_relevant fully satisfied a dependency in all three engines,
  // so an עוסק מורשה who dismissed "open a VAT file" as not relevant thereby
  // unlocked a real, penalty-framed periodic VAT obligation.
  const murshe = { entityType: "osek_murshe" as const, vatFrequency: "bimonthly" as const };

  it("does NOT invent a VAT duty when the VAT file was dismissed as not applicable", () => {
    const obligations = computeUpcomingObligations(
      [
        task({ template_id: "open-vat-file", status: "not_relevant", dismissal: "not_applicable" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      murshe
    );
    expect(obligations.some((o) => o.kind === "vat")).toBe(false);
  });

  it("reads a legacy dismissal with no recorded kind the same conservative way", () => {
    const obligations = computeUpcomingObligations(
      [
        task({ template_id: "open-vat-file", status: "not_relevant", dismissal: null }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      murshe
    );
    expect(obligations.some((o) => o.kind === "vat")).toBe(false);
  });

  it("DOES show the VAT duty when the file is handled outside BizReady", () => {
    // "my accountant opened it" means the prerequisite is genuinely met, so the
    // obligation is real and withholding its dates would be the bigger error.
    const obligations = computeUpcomingObligations(
      [
        task({
          template_id: "open-vat-file",
          status: "not_relevant",
          dismissal: "handled_externally",
        }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID,
      [],
      today,
      murshe
    );
    expect(obligations.some((o) => o.kind === "vat")).toBe(true);
  });
});

describe("filingsBlockedByDismissal", () => {
  it("names the filing and the prerequisite the user set aside", () => {
    const blocked = filingsBlockedByDismissal(
      [
        task({ template_id: "open-vat-file", status: "not_relevant", dismissal: "not_applicable" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID
    );
    expect(blocked).toEqual([
      { templateId: "vat-reporting", blockedBy: "open-vat-file", dismissal: "not_applicable" },
    ]);
  });

  it("says nothing when the prerequisite is merely unfinished", () => {
    // A new business that has not opened its VAT file yet should see no VAT
    // deadlines and no warning — the duty genuinely does not exist yet. That is
    // the honest-deadline principle, not a problem to report.
    const blocked = filingsBlockedByDismissal(
      [
        task({ template_id: "open-vat-file", status: "todo" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID
    );
    expect(blocked).toEqual([]);
  });

  it("says nothing when the prerequisite is handled externally — nothing is blocked", () => {
    const blocked = filingsBlockedByDismissal(
      [
        task({
          template_id: "open-vat-file",
          status: "not_relevant",
          dismissal: "handled_externally",
        }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID
    );
    expect(blocked).toEqual([]);
  });

  it("says nothing about a prerequisite absent from the plan", () => {
    // vat-reporting depends on open-vat-file OR company-tax-files; the absent
    // one is the alternative-prerequisite convention, not a block.
    const blocked = filingsBlockedByDismissal(
      [
        task({ template_id: "company-tax-files", status: "done" }),
        task({ template_id: "vat-reporting" }),
      ],
      TEMPLATES_BY_ID
    );
    expect(blocked).toEqual([]);
  });
});

describe("duties that have not started yet are named, not hidden in silence", () => {
  /**
   * computeUpcomingObligations hides a filing whose prerequisite is unfinished,
   * and that is correct — there is no VAT duty before the file is open, and
   * inventing one is what made the home screen report debts nobody owed.
   *
   * But an empty board reading "אין חובות עתידיות כרגע" tells a new עוסק they
   * have no obligations, when the truth is that theirs begin the moment they
   * finish one task. This is the sentence that has to exist.
   */
  const templates = TEMPLATES_BY_ID;

  it("names a VAT duty waiting on an unopened file, and what unlocks it", () => {
    const pending = filingsAwaitingPrerequisite(
      [
        { template_id: "open-vat-file", status: "todo", is_relevant: true },
        { template_id: "vat-reporting", status: "todo", is_relevant: true },
      ],
      templates
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].templateId).toBe("vat-reporting");
    expect(pending[0].awaiting).toBe("open-vat-file");
    expect(pending[0].awaitingTitle).toContain("מע");
  });

  it("says nothing once the prerequisite is done — the duty is real by then", () => {
    const pending = filingsAwaitingPrerequisite(
      [
        { template_id: "open-vat-file", status: "done", is_relevant: true },
        { template_id: "vat-reporting", status: "todo", is_relevant: true },
      ],
      templates
    );
    expect(pending).toEqual([]);
  });

  it("leaves a dismissed prerequisite to the dismissal message", () => {
    // Two different stories: "finish this and your duty starts" versus "your
    // own choice is holding a duty back". Mixing them would say both at once.
    const pending = filingsAwaitingPrerequisite(
      [
        {
          template_id: "open-vat-file",
          status: "not_relevant",
          is_relevant: false,
          dismissal: "not_applicable",
        },
        { template_id: "vat-reporting", status: "todo", is_relevant: true },
      ],
      templates
    );
    expect(pending).toEqual([]);
  });

  it("does not nag about a filing already completed", () => {
    const pending = filingsAwaitingPrerequisite(
      [
        { template_id: "open-vat-file", status: "todo", is_relevant: true },
        { template_id: "vat-reporting", status: "done", is_relevant: true },
      ],
      templates
    );
    expect(pending).toEqual([]);
  });

  it("treats a prerequisite absent from the plan as satisfied, not pending", () => {
    // A company opens its files as a legal person, so open-vat-file is simply
    // not in its plan. That is the alternative-prerequisite convention, and
    // reading it as a block would invent a blocker for every company.
    const pending = filingsAwaitingPrerequisite(
      [{ template_id: "vat-reporting", status: "todo", is_relevant: true }],
      templates
    );
    expect(pending).toEqual([]);
  });
});
