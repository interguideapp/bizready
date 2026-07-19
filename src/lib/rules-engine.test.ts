import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, TEMPLATES_BY_ID } from "@/lib/content";
import type { OnboardingAnswers } from "@/lib/types";
import {
  buildPlan,
  computeScore,
  nextSteps,
  reconcilePlan,
} from "./rules-engine";

/** קוסמטיקאית עוסק פטור מהבית, בלי אתר, לקוחות פרטיים */
const cosmetician: OnboardingAnswers = {
  stage: "setting_up",
  entity_type: "osek_patur",
  field: "beauty_care",
  expected_revenue: "60k_to_ceiling",
  work_location: "home",
  sales_channel: "in_person",
  client_type: "private",
  hosts_clients: true,
  collects_personal_data: true,
  uses_vehicle: false,
  has_website: false,
  plans_employees: false,
  already_done: [],
};

/** חנות אונליין עוסק מורשה עם אתר, לקוחות פרטיים ועסקיים */
const onlineShop: OnboardingAnswers = {
  stage: "active",
  entity_type: "osek_murshe",
  field: "commerce",
  expected_revenue: "over_ceiling",
  work_location: "online_only",
  sales_channel: "online",
  client_type: "both",
  hosts_clients: false,
  collects_personal_data: true,
  uses_vehicle: true,
  has_website: true,
  plans_employees: false,
  already_done: ["open-vat-file", "build-website", "buy-domain"],
};

describe("buildPlan", () => {
  it("gives every business the universal critical basics", () => {
    for (const answers of [cosmetician, onlineShop]) {
      const ids = buildPlan(answers, TASK_TEMPLATES).map((t) => t.template_id);
      expect(ids).toContain("open-vat-file");
      expect(ids).toContain("open-bituach-leumi-file");
      expect(ids).toContain("mandatory-pension");
      expect(ids).toContain("pricing");
    }
  });

  it("cosmetician gets licensing + third-party insurance, no website tasks", () => {
    const ids = buildPlan(cosmetician, TASK_TEMPLATES).map((t) => t.template_id);
    expect(ids).toContain("business-license"); // תחום טעון רישוי
    expect(ids).toContain("third-party-insurance"); // מקבלת קהל
    expect(ids).toContain("google-business-profile"); // עסק מקומי
    expect(ids).toContain("privacy-policy"); // אוספת פרטים
    expect(ids).not.toContain("website-accessibility"); // אין אתר
    expect(ids).not.toContain("vat-reporting"); // פטור לא מדווח מע"מ
    expect(ids).toContain("patur-ceiling-watch"); // מעקב תקרה לפטור
    expect(ids).not.toContain("vehicle-expenses"); // בלי רכב
  });

  it("online shop gets VAT + website duties, no patur/local tasks", () => {
    const ids = buildPlan(onlineShop, TASK_TEMPLATES).map((t) => t.template_id);
    expect(ids).toContain("vat-reporting"); // מורשה
    expect(ids).toContain("website-accessibility"); // יש אתר
    expect(ids).toContain("website-terms");
    expect(ids).toContain("withholding-certificate"); // לקוחות עסקיים
    expect(ids).toContain("vehicle-expenses");
    expect(ids).not.toContain("patur-ceiling-watch"); // לא פטור
    expect(ids).not.toContain("business-license"); // מסחר אונליין
    expect(ids).not.toContain("third-party-insurance"); // לא מקבל קהל
    expect(ids).not.toContain("google-business-profile"); // אונליין בלבד
  });

  it("the two personas get clearly different plans", () => {
    const a = new Set(buildPlan(cosmetician, TASK_TEMPLATES).map((t) => t.template_id));
    const b = new Set(buildPlan(onlineShop, TASK_TEMPLATES).map((t) => t.template_id));
    const onlyA = [...a].filter((id) => !b.has(id));
    const onlyB = [...b].filter((id) => !a.has(id));
    expect(onlyA.length).toBeGreaterThanOrEqual(3);
    expect(onlyB.length).toBeGreaterThanOrEqual(3);
  });

  it("marks already_done templates as done and sets due dates", () => {
    const plan = buildPlan(onlineShop, TASK_TEMPLATES, new Date("2026-07-18"));
    const vat = plan.find((t) => t.template_id === "open-vat-file")!;
    expect(vat.status).toBe("done");
    expect(vat.due_date).toBe("2026-07-18"); // deadline_days: 0
    const bituach = plan.find((t) => t.template_id === "open-bituach-leumi-file")!;
    expect(bituach.status).toBe("todo");
    expect(bituach.due_date).toBe("2026-08-01"); // +14 days
  });
});

describe("computeScore", () => {
  it("scores 0 for a fresh plan and 100 when everything is done", () => {
    const plan = buildPlan(cosmetician, TASK_TEMPLATES);
    const fresh = computeScore(
      plan.map((t) => ({ ...t, status: "todo" as const })),
      TEMPLATES_BY_ID
    );
    expect(fresh.overall).toBe(0);

    const complete = computeScore(
      plan.map((t) => ({ ...t, status: "done" as const })),
      TEMPLATES_BY_ID
    );
    expect(complete.overall).toBe(100);
  });

  it("weights critical tasks more than recommended ones", () => {
    const plan = buildPlan(cosmetician, TASK_TEMPLATES);
    const doneOne = (id: string) =>
      computeScore(
        plan.map((t) => ({
          ...t,
          status: t.template_id === id ? ("done" as const) : ("todo" as const),
        })),
        TEMPLATES_BY_ID
      ).overall;
    // open-vat-file is critical; business-name-check is recommended
    expect(doneOne("open-vat-file")).toBeGreaterThan(doneOne("business-name-check"));
  });

  it("excludes not_relevant tasks from the score", () => {
    const plan = buildPlan(cosmetician, TASK_TEMPLATES);
    const withIrrelevant = computeScore(
      plan.map((t, i) => ({
        ...t,
        status: i === 0 ? ("not_relevant" as const) : ("done" as const),
      })),
      TEMPLATES_BY_ID
    );
    expect(withIrrelevant.overall).toBe(100);
  });
});

describe("nextSteps", () => {
  it("suggests unblocked critical tasks first", () => {
    const plan = buildPlan(cosmetician, TASK_TEMPLATES, new Date("2026-07-18"));
    const steps = nextSteps(plan, TEMPLATES_BY_ID);
    expect(steps.length).toBe(3);
    // dependencies not done yet => dependent tasks must not appear
    expect(steps).not.toContain("open-income-tax-file"); // depends on open-vat-file
    expect(steps[0]).toBe("open-vat-file"); // critical, due today
  });

  it("unlocks dependent tasks once dependencies are done", () => {
    const plan = buildPlan(cosmetician, TASK_TEMPLATES, new Date("2026-07-18")).map(
      (t) => ({
        ...t,
        status:
          t.template_id === "open-vat-file" ? ("done" as const) : t.status,
      })
    );
    const steps = nextSteps(plan, TEMPLATES_BY_ID, 10);
    expect(steps).toContain("open-income-tax-file");
  });
});

describe("reconcilePlan", () => {
  it("adds website tasks when the user launches a site, keeps history", () => {
    const before = buildPlan(cosmetician, TASK_TEMPLATES);
    const after = reconcilePlan(
      { ...cosmetician, has_website: true },
      TASK_TEMPLATES,
      before.map((t) => ({ template_id: t.template_id, is_relevant: true }))
    );
    const addedIds = after.toAdd.map((t) => t.template_id);
    expect(addedIds).toContain("website-accessibility");
    expect(addedIds).toContain("website-terms");
    expect(after.toFlagIrrelevant).toEqual([]);
  });

  it("flags patur-only tasks irrelevant on switch to murshe, and back", () => {
    const before = buildPlan(cosmetician, TASK_TEMPLATES);
    const existing = before.map((t) => ({
      template_id: t.template_id,
      is_relevant: true,
    }));
    const switched = reconcilePlan(
      { ...cosmetician, entity_type: "osek_murshe" },
      TASK_TEMPLATES,
      existing
    );
    expect(switched.toFlagIrrelevant).toContain("patur-ceiling-watch");
    expect(switched.toAdd.map((t) => t.template_id)).toContain("vat-reporting");
  });

  it("template dependencies all reference existing templates", () => {
    for (const t of TASK_TEMPLATES) {
      for (const dep of t.depends_on) {
        expect(TEMPLATES_BY_ID.has(dep), `${t.id} depends on missing ${dep}`).toBe(true);
      }
    }
  });
});
