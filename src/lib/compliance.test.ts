import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  computeUpcomingObligations,
  crossedWindows,
  REMINDER_WINDOWS_PRO,
  type ComplianceTask,
} from "./compliance";

const today = new Date("2026-07-20T09:00:00Z");

function task(partial: Partial<ComplianceTask> & { template_id: string }): ComplianceTask {
  return { status: "todo", is_relevant: true, completion_data: null, ...partial };
}

describe("computeUpcomingObligations — real anchors", () => {
  it("anchors VAT to the 15th of the following month", () => {
    const obs = computeUpcomingObligations(
      [task({ template_id: "vat-reporting" })],
      TEMPLATES_BY_ID,
      [],
      today
    );
    // today is 2026-07-20 → the 15th passed, so next is 2026-08-15
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe("vat");
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
  });

  it("surfaces a document expiry as its own obligation", () => {
    const obs = computeUpcomingObligations(
      [],
      TEMPLATES_BY_ID,
      [{ name: "פוליסת אחריות מקצועית", expires_at: "2026-09-01" }],
      today
    );
    expect(obs[0].kind).toBe("document_expiry");
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
    expect(obs.some((o) => o.templateId === "bookkeeping")).toBe(false);
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
