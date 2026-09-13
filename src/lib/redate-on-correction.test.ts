import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcilePlan } from "@/lib/rules-engine";
import { TASK_TEMPLATES } from "@/lib/content";
import type { OnboardingAnswers } from "@/lib/types";

/**
 * Correcting "the business is already active" has to clear the dates that
 * answer invented.
 *
 * buildPlan dates a non-statutory task as addDays(today, deadline_days) —
 * unless the business is already ACTIVE, in which case it gets no date at all,
 * because "פתיחת תיק עוסק במע״מ — מומלץ עד <signup + 30>" is fiction for work
 * finished years ago. That is B5, and it was fixed at plan-BUILD time only.
 *
 * reconcilePlan, which runs on every recalibration, decided which tasks EXIST
 * and nothing else. So someone who signed up as setting_up, got forty invented
 * recommended dates, and later corrected the answer to active kept every one
 * of them. Those dates feed the obligations board, taskImportance and the
 * exposure ranking, and turn into "היה מומלץ עד" as they pass — the correction
 * changed the plan's shape and left its fiction in place.
 *
 * This is the other half of what a catch-up pass is for: /catch-up says what
 * was DONE, and this says the business was never new.
 */
/** A full answer set, so the cast is not hiding a missing field. */
const base: OnboardingAnswers = {
  stage: "setting_up",
  entity_type: "osek_patur",
  field: "beauty_care",
  expected_revenue: "60k_to_ceiling",
  work_location: "home",
  sales_channel: "in_person",
  client_type: "private",
  product_type: "services",
  hosts_clients: true,
  collects_personal_data: true,
  uses_vehicle: false,
  has_website: false,
  plans_employees: false,
  employee_work_mode: "on_site",
  wants_marketing: true,
  already_done: [],
};

const active: OnboardingAnswers = { ...base, stage: "active" };
const TODAY = new Date("2026-09-14T09:00:00Z");

/** The plan a setting_up signup would have produced, as stored rows. */
function storedFromSettingUp() {
  const { toAdd } = reconcilePlan(base, TASK_TEMPLATES, [], TODAY);
  return toAdd.map((t) => ({
    template_id: t.template_id,
    is_relevant: true,
    status: "todo",
    due_date: t.due_date,
  }));
}

describe("correcting the stage clears the invented dates", () => {
  it("a setting_up signup really does get dated tasks", () => {
    // Guards the premise: if this were empty the test below would pass for the
    // wrong reason.
    const dated = storedFromSettingUp().filter((t) => t.due_date !== null);
    expect(dated.length).toBeGreaterThan(3);
  });

  it("switching to active asks for those dates to be cleared", () => {
    const stored = storedFromSettingUp();
    const { toRedate } = reconcilePlan(active, TASK_TEMPLATES, stored, TODAY);
    expect(toRedate.length).toBeGreaterThan(3);
    expect(toRedate.every((t) => t.due_date === null)).toBe(true);
  });

  it("never touches a statutory filing's date", () => {
    /**
     * Reached through vat_frequency, not through stage.
     *
     * My first version of this changed only the stage and passed with the
     * statutory guard DELETED — because stage does not affect a statutory
     * date, so planned equalled stored and nothing was proposed either way.
     * The guard matters when the answers really do move a legal deadline, and
     * then it matters a lot: updateAnswers re-anchors statutory dates from the
     * filing rules immediately afterwards, so allowing them here would give one
     * legal date two writers.
     */
    // An עוסק מורשה, because an עוסק פטור files no VAT return at all and the
    // template is simply absent from its plan — which is what my first
    // fixture got wrong.
    const murshe: OnboardingAnswers = { ...base, entity_type: "osek_murshe" };
    const monthly: OnboardingAnswers = { ...murshe, vat_frequency: "monthly" };
    const bimonthly: OnboardingAnswers = { ...murshe, vat_frequency: "bimonthly" };
    /*
     * 10 October, because on 14 September the two frequencies COINCIDE — a
     * monthly filer owes September by 15 Oct and a bimonthly filer owes
     * Jul–Aug by 15 Sep, and my fixture produced the same date for both, so
     * the premise assertion caught it. On 10 October monthly owes 15 Oct and
     * bimonthly owes 15 Nov.
     */
    const OCT = new Date("2026-10-10T09:00:00Z");
    const stored = reconcilePlan(bimonthly, TASK_TEMPLATES, [], OCT).toAdd.map((t) => ({
      template_id: t.template_id,
      is_relevant: true,
      status: "todo",
      due_date: t.due_date,
    }));
    const statutory = ["vat-reporting", "income-tax-advances", "annual-tax-report"];

    // The premise: this change really does move a statutory date.
    const plannedNow = reconcilePlan(monthly, TASK_TEMPLATES, [], OCT).toAdd;
    const vatBefore = stored.find((t) => t.template_id === "vat-reporting")?.due_date;
    const vatAfter = plannedNow.find((t) => t.template_id === "vat-reporting")?.due_date;
    expect(vatBefore, "vat-reporting is not dated at all").toBeTruthy();
    expect(vatAfter).not.toBe(vatBefore);

    const { toRedate } = reconcilePlan(monthly, TASK_TEMPLATES, stored, OCT);
    expect(toRedate.filter((t) => statutory.includes(t.template_id))).toEqual([]);
  });

  it("leaves a finished task alone", () => {
    // Re-dating something already done says nothing about anything.
    const stored = storedFromSettingUp().map((t) => ({ ...t, status: "done" }));
    const { toRedate } = reconcilePlan(active, TASK_TEMPLATES, stored, TODAY);
    expect(toRedate).toEqual([]);
  });

  it("asks for nothing when the answers did not change", () => {
    // Otherwise every visit to settings would rewrite every date.
    const stored = storedFromSettingUp();
    const { toRedate } = reconcilePlan(base, TASK_TEMPLATES, stored, TODAY);
    expect(toRedate).toEqual([]);
  });

  it("ignores a task no longer in the plan", () => {
    // It is being flagged irrelevant in the same pass; dating it is noise.
    const { toRedate } = reconcilePlan(
      active,
      TASK_TEMPLATES,
      [{ template_id: "register-company", is_relevant: true, status: "todo", due_date: "2026-10-01" }],
      TODAY
    );
    expect(toRedate).toEqual([]);
  });

  it("also fills a date IN when a correction creates one", () => {
    // The reverse direction: an active business that says it is only setting
    // up now gets the recommendation it should have had.
    const stored = reconcilePlan(active, TASK_TEMPLATES, [], TODAY).toAdd.map((t) => ({
      template_id: t.template_id,
      is_relevant: true,
      status: "todo",
      due_date: t.due_date,
    }));
    const { toRedate } = reconcilePlan(base, TASK_TEMPLATES, stored, TODAY);
    expect(toRedate.length).toBeGreaterThan(3);
    expect(toRedate.every((t) => t.due_date !== null)).toBe(true);
  });
});

describe("the recalibration applies it", () => {
  const actions = readFileSync(join(process.cwd(), "src/lib/actions.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  it("reads the stored dates, or it cannot tell what changed", () => {
    expect(actions).toContain('.select("template_id, is_relevant, status, due_date")');
  });

  it("takes toRedate from the reconcile and writes it", () => {
    expect(actions).toContain("toRedate");
    expect(actions).toContain("byDate");
  });

  it("groups by date instead of one statement per task", () => {
    // Forty tasks collapse into a handful of distinct dates.
    expect(actions).toContain('.in("template_id", templateIds)');
  });

  it("writes a real null rather than the empty-string key", () => {
    expect(actions).toContain('key === "" ? null : key');
  });
});
