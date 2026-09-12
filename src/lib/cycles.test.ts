import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import type { ComplianceProfile } from "@/lib/compliance";
import { nextCycleFor, projectCycles, reopenedCycle, type CycleTask } from "@/lib/cycles";

/**
 * The next cycle, after the current one was closed.
 *
 * Written because the product had no answer. Filing VAT set the row to `done`
 * and nothing but the nightly sweep ever changed it back — so with the sweep
 * not running, the task read "בוצע" while the next deadline passed, and the
 * obligations board (which computes its dates independently) said the opposite.
 */

const BIMONTHLY: ComplianceProfile = { entityType: "osek_murshe", vatFrequency: "bimonthly" };
const MONTHLY: ComplianceProfile = { entityType: "osek_murshe", vatFrequency: "monthly" };

const vatTemplate = TEMPLATES_BY_ID.get("vat-reporting")!;
const insuranceTemplate = TEMPLATES_BY_ID.get("professional-liability-insurance")!;

function filed(over: Partial<CycleTask> = {}): CycleTask {
  return {
    template_id: "vat-reporting",
    status: "done",
    due_date: "2026-09-15",
    completed_at: "2026-09-10T08:00:00Z",
    ...over,
  };
}

describe("a filed statutory period does not stay filed forever", () => {
  it("opens the next period as soon as the filed one is behind, and names it", () => {
    // 20 September: Jul–Aug was filed on the 10th, so Sep–Oct is now running
    // with a 15 November deadline. The task opens for it NOW rather than in
    // mid-November, because a user who first hears about a period once they
    // are late for it has been told too late to act.
    const open = reopenedCycle({
      task: filed({ filed_periods: ["2026-07..2026-08"] }),
      template: vatTemplate,
      today: new Date("2026-09-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(open?.reason).toBe("period");
    expect(open?.periodKey).toBe("2026-09..2026-10");
    expect(open?.periodLabel).toBe("ספטמבר–אוקטובר 2026");
    expect(open?.dueIso).toBe("2026-11-15");
  });

  it("stays closed while the period it covered is still the running one", () => {
    // Filed on the 10th for Jul–Aug, whose deadline is the 15th. Nothing has
    // turned over yet.
    expect(
      reopenedCycle({
        task: filed({ due_date: "2026-11-15", filed_periods: ["2026-09..2026-10"] }),
        template: vatTemplate,
        today: new Date("2026-11-10T09:00:00Z"),
        profile: BIMONTHLY,
      })
    ).toBeNull();
  });

  it("does not reopen a period the ledger says was filed early", () => {
    // Filed Sep–Oct before its deadline. Telling someone they owe a filing
    // they have already made is the fastest way to lose the alarm.
    expect(
      reopenedCycle({
        task: filed({ filed_periods: ["2026-07..2026-08", "2026-09..2026-10"] }),
        template: vatTemplate,
        today: new Date("2026-10-20T09:00:00Z"),
        profile: BIMONTHLY,
      })
    ).toBeNull();
  });

  it("carries the OVERDUE date when a passed period went unfiled", () => {
    // 20 November with Sep–Oct (due the 15th) unrecorded. The running period
    // is Nov–Dec, due 15 January — and putting that comfortable future date on
    // the task while a deadline sits five days behind would be the same
    // "in 56 days" lie the two engines used to tell each other.
    const open = reopenedCycle({
      task: filed({ filed_periods: ["2026-07..2026-08"] }),
      template: vatTemplate,
      today: new Date("2026-11-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(open?.dueIso).toBe("2026-11-15");
    expect(open?.periodKey).toBe("2026-09..2026-10");
  });

  it("follows the user's real frequency, not the template's hardcoded one", () => {
    // vat-reporting declares recurrence "bimonthly" in content. A monthly
    // filer's cycle is a month, and reading the template instead of the answer
    // is how every other period got silently skipped.
    const monthly = reopenedCycle({
      task: filed({ due_date: "2026-09-15", filed_periods: ["2026-08..2026-08"] }),
      template: vatTemplate,
      today: new Date("2026-10-16T09:00:00Z"),
      profile: MONTHLY,
    });
    expect(monthly?.periodKey).toBe("2026-09..2026-09");
    expect(monthly?.dueIso).toBe("2026-10-15");
  });

  it("falls back to the stored deadline where there is no ledger at all", () => {
    // History predating the ledger (030). The stored deadline is then the only
    // statement of which period the completion covered, and this reproduces the
    // sweep's own condition so the two cannot disagree. A period missed back
    // then stays invisible here, which is honest: nothing recorded it either way.
    const today = new Date("2026-11-20T09:00:00Z");
    expect(reopenedCycle({ task: filed(), template: vatTemplate, today, profile: BIMONTHLY })?.dueIso).toBe(
      "2027-01-15"
    );
    expect(
      reopenedCycle({
        task: filed({ due_date: "2027-01-15" }),
        template: vatTemplate,
        today,
        profile: BIMONTHLY,
      })
    ).toBeNull();
  });

  it("never reopens a task that is already open", () => {
    // It is open. Reopening it would double-count the same duty on every
    // surface that counts open work.
    for (const status of ["todo", "in_progress", "waiting"] as const) {
      expect(
        reopenedCycle({
          task: filed({ status, filed_periods: [] }),
          template: vatTemplate,
          today: new Date("2026-11-20T09:00:00Z"),
          profile: BIMONTHLY,
        })
      ).toBeNull();
    }
  });
});

describe("a renewal is dated by the document, not by when it was ticked", () => {
  it("reopens on the renewal date the user entered", () => {
    // A policy bought in March and expiring in January renews in January.
    // Anchoring to completed_at would have said March, two months late.
    const task: CycleTask = {
      template_id: "professional-liability-insurance",
      status: "done",
      due_date: null,
      completed_at: "2026-03-01T08:00:00Z",
      completion_data: { insurer: "X", renewal: "2027-01-10" },
    };
    expect(
      reopenedCycle({ task, template: insuranceTemplate, today: new Date("2026-12-20T09:00:00Z"), profile: {} })
    ).toBeNull();
    const open = reopenedCycle({
      task,
      template: insuranceTemplate,
      today: new Date("2027-01-10T09:00:00Z"),
      profile: {},
    });
    expect(open?.reason).toBe("renewal");
    expect(open?.dueIso).toBe("2027-01-10");
  });

  it("reopens on the day itself, not the day after", () => {
    // One day without cover is the thing being prevented.
    const task: CycleTask = {
      template_id: "professional-liability-insurance",
      status: "done",
      due_date: null,
      completed_at: "2026-01-01T08:00:00Z",
      completion_data: { renewal: "2026-09-13" },
    };
    expect(
      reopenedCycle({ task, template: insuranceTemplate, today: new Date("2026-09-13T06:00:00Z"), profile: {} })
    ).not.toBeNull();
  });

  it("ignores a renewal field that is not a date", () => {
    const task: CycleTask = {
      template_id: "professional-liability-insurance",
      status: "done",
      due_date: null,
      completed_at: "2020-01-01T08:00:00Z",
      completion_data: { renewal: "בעוד שנה" },
    };
    // Falls through to the yearly habit rather than crashing or inventing a date.
    const open = reopenedCycle({ task, template: insuranceTemplate, today: new Date("2026-09-13T09:00:00Z"), profile: {} });
    expect(open?.reason).toBe("habit");
  });
});

describe("what is my next deadline for this", () => {
  it("names the next period and its deadline for a filed VAT task", () => {
    const next = nextCycleFor({
      task: filed({ filed_periods: ["2026-07..2026-08"] }),
      template: vatTemplate,
      today: new Date("2026-09-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(next?.dueIso).toBe("2026-11-15");
    expect(next?.periodLabel).toBe("ספטמבר–אוקטובר 2026");
    // Not yet arrived — this is the answer to "what is next", not "what is due".
    expect(next?.open).toBe(false);
  });

  it("gives no next date for a demand-triggered duty rather than guessing one", () => {
    // הצהרת הון has no calendar rule: the 120 days run from a demand letter.
    const template = TEMPLATES_BY_ID.get("capital-statement-prep");
    if (!template) return;
    const next = nextCycleFor({
      task: { template_id: "capital-statement-prep", status: "done", due_date: null, completed_at: "2026-01-01T00:00:00Z" },
      template,
      today: new Date("2026-09-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(next?.reason === "period" ? next.dueIso : null).toBeNull();
  });

  it("gives no next cycle for a one-off task", () => {
    const template = TEMPLATES_BY_ID.get("open-vat-file")!;
    expect(
      nextCycleFor({
        task: { template_id: "open-vat-file", status: "done", due_date: null, completed_at: "2026-01-01T00:00:00Z" },
        template,
        today: new Date("2026-09-20T09:00:00Z"),
        profile: BIMONTHLY,
      })
    ).toBeNull();
  });
});

describe("projecting cycles onto a task list", () => {
  it("shows a reopened duty as open work, and says why", () => {
    const [projected] = projectCycles([filed({ filed_periods: ["2026-07..2026-08"] })], {
      templates: TEMPLATES_BY_ID,
      today: new Date("2026-11-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(projected.status).toBe("todo");
    expect(projected.completed_at).toBeNull();
    expect(projected.due_date).toBe("2026-11-15");
    // The user remembers filing. Un-ticking it without a reason is worse than
    // leaving it ticked.
    expect(projected.cycle?.periodLabel).toBe("ספטמבר–אוקטובר 2026");
  });

  it("leaves a task whose cycle has not turned over exactly as it was", () => {
    const task = filed({ due_date: "2026-11-15", filed_periods: ["2026-09..2026-10"] });
    const [projected] = projectCycles([task], {
      templates: TEMPLATES_BY_ID,
      today: new Date("2026-11-10T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(projected).toEqual(task);
  });

  it("takes the ledger from the shared map when the task does not carry it", () => {
    const [projected] = projectCycles([filed({ due_date: "2026-11-15" })], {
      templates: TEMPLATES_BY_ID,
      today: new Date("2026-11-10T09:00:00Z"),
      profile: BIMONTHLY,
      filedPeriods: new Map([["vat-reporting", ["2026-09..2026-10"]]]),
    });
    expect(projected.status).toBe("done");
  });

  it("passes through a task whose template is gone", () => {
    // Content is code; a retired template must not throw on a stored row.
    const task = filed({ template_id: "retired-task" });
    const [projected] = projectCycles([task], {
      templates: TEMPLATES_BY_ID,
      today: new Date("2026-11-20T09:00:00Z"),
      profile: BIMONTHLY,
    });
    expect(projected).toEqual(task);
  });
});
