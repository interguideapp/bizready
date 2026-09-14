import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/rules-engine";
import { TASK_TEMPLATES } from "@/lib/content";
import { nextStatutoryDueDate } from "@/lib/compliance";
import { todayInIsrael } from "@/lib/dates";
import type { OnboardingAnswers } from "@/lib/types";

/**
 * ONE "TODAY" PER PLAN.
 *
 * buildPlan dates each task from one of two branches: a statutory filing goes
 * through nextStatutoryDueDate, which resolves the calendar day with
 * israelParts, and a recommended task went through a local addDays that read
 * the UTC day off the same instant.
 *
 * Israel is UTC+2/+3, so a plan built between Israeli midnight and
 * 02:00/03:00 dated its statutory filings from today and its recommended
 * tasks from yesterday. One day early on a recommendation is the harmless
 * direction, which is why nothing noticed — and it was still two answers to
 * "what day is it" inside one expression, in the function that dates every
 * task a business is ever given.
 */
const answers = (over: Partial<OnboardingAnswers> = {}): OnboardingAnswers =>
  ({
    entity_type: "osek_patur",
    stage: "setting_up",
    field: "other",
    ...over,
  }) as OnboardingAnswers;

/** Jerusalem's day for an instant, computed independently of the engine. */
const jerusalemDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/** N days after a calendar day, computed independently of the engine. */
function dayPlus(dayIso: string, days: number): string {
  const d = new Date(dayIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("recommended dates are counted from the Israeli day", () => {
  const LATE = new Date("2026-09-14T22:30:00Z"); // 01:30 on the 15th in Israel

  it("the premise: UTC and Jerusalem disagree at this instant", () => {
    expect(LATE.toISOString().slice(0, 10)).toBe("2026-09-14");
    expect(jerusalemDay(LATE)).toBe("2026-09-15");
  });

  it("every recommended date sits a whole number of days after Israel's day", () => {
    const plan = buildPlan(answers(), TASK_TEMPLATES, LATE);
    const dated = plan.filter((p) => p.due_date !== null);
    expect(dated.length).toBeGreaterThan(0);
    const byId = new Map(TASK_TEMPLATES.map((t) => [t.id, t]));
    let checked = 0;
    for (const task of dated) {
      const template = byId.get(task.template_id)!;
      // Statutory dates come from the filing calendar, not from a day offset.
      if (nextStatutoryDueDate(template.id, LATE, { entityType: "osek_patur" }) !== null) continue;
      if (template.deadline_days == null) continue;
      expect(task.due_date, template.id).toBe(
        dayPlus(jerusalemDay(LATE), template.deadline_days)
      );
      checked++;
    }
    expect(checked, "no recommended dated task in this plan").toBeGreaterThan(0);
  });

  it("agrees with todayInIsrael, which every other surface uses", () => {
    // The point of the fix: the plan's notion of today is the product's.
    expect(jerusalemDay(LATE)).toBe(todayInIsrael(LATE));
  });
});

describe("across a month boundary, at every hour", () => {
  /**
   * A single instant only separates Jerusalem from SOME host zones — this
   * machine's resolves to Asia/Bangkok — and TZ is not honoured here, so the
   * boundary is swept and the premise asserted.
   */
  it("never dates a recommendation from the UTC day", () => {
    const start = Date.parse("2026-09-30T00:00:00Z");
    const byId = new Map(TASK_TEMPLATES.map((t) => [t.id, t]));
    let separated = 0;
    for (let h = 0; h < 48; h += 2) {
      const at = new Date(start + h * 3_600_000);
      const plan = buildPlan(answers(), TASK_TEMPLATES, at);
      for (const task of plan) {
        if (task.due_date === null) continue;
        const template = byId.get(task.template_id)!;
        if (nextStatutoryDueDate(template.id, at, { entityType: "osek_patur" }) !== null) continue;
        if (template.deadline_days == null) continue;
        expect(task.due_date, at.toISOString() + " " + template.id).toBe(
          dayPlus(jerusalemDay(at), template.deadline_days)
        );
      }
      if (at.toISOString().slice(0, 10) !== jerusalemDay(at)) separated++;
    }
    expect(
      separated,
      "no hour in this window separates UTC from Jerusalem, so this proves nothing"
    ).toBeGreaterThan(0);
  });
});

describe("an already-operating business is still given no invented dates", () => {
  it("dates no recommended task when the stage says active", () => {
    // The behaviour the branch exists for, kept intact by the change: a
    // three-year-old business must not be handed "recommended by signup + 30".
    const plan = buildPlan(answers({ stage: "active" }), TASK_TEMPLATES, new Date("2026-09-14T22:30:00Z"));
    const byId = new Map(TASK_TEMPLATES.map((t) => [t.id, t]));
    for (const task of plan) {
      const template = byId.get(task.template_id)!;
      if (nextStatutoryDueDate(template.id, new Date(), { entityType: "osek_patur" }) !== null) continue;
      expect(task.due_date, template.id).toBeNull();
    }
  });
});
