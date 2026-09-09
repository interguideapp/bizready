import { describe, expect, it } from "vitest";
import { greetingFor, buildQuickWins, estMinutes, isQuickTask, type QuickWinContext } from "./home";

describe("greetingFor", () => {
  it("maps the hour to the right Hebrew greeting", () => {
    expect(greetingFor(7)).toBe("בוקר טוב");
    expect(greetingFor(13)).toBe("צהריים טובים");
    expect(greetingFor(19)).toBe("ערב טוב");
    expect(greetingFor(2)).toBe("לילה טוב");
    expect(greetingFor(23)).toBe("לילה טוב");
  });
});

describe("estMinutes / isQuickTask", () => {
  it("parses common Hebrew time estimates", () => {
    expect(estMinutes("5 דקות")).toBe(5);
    expect(estMinutes("רבע שעה")).toBe(15);
    expect(estMinutes("חצי שעה")).toBe(30);
    expect(estMinutes("כשעה")).toBe(60);
    expect(estMinutes("10–15 דקות")).toBe(10);
    expect(estMinutes(undefined)).toBeNull();
  });
  it("treats ≤20 minutes as a quick task", () => {
    expect(isQuickTask(5)).toBe(true);
    expect(isQuickTask(20)).toBe(true);
    expect(isQuickTask(60)).toBe(false);
    expect(isQuickTask(null)).toBe(false);
  });
});

describe("buildQuickWins", () => {
  const base: QuickWinContext = {
    hasIncome: true,
    profilePercent: 100,
    documentsCount: 3,
    productsCount: 2,
    loggedIncomeThisMonth: true,
    shortTasks: [],
  };

  it("returns nothing to nag about when everything is complete and no short tasks", () => {
    expect(buildQuickWins(base)).toEqual([]);
  });

  it("surfaces income logging first when this month isn't logged", () => {
    const wins = buildQuickWins({ ...base, loggedIncomeThisMonth: false });
    expect(wins[0].id).toBe("log-income");
  });

  it("orders data-completeness wins before task wins and caps the list", () => {
    const wins = buildQuickWins(
      {
        hasIncome: false,
        profilePercent: 60,
        documentsCount: 0,
        productsCount: 0,
        loggedIncomeThisMonth: false,
        shortTasks: [{ templateId: "buy-domain", title: "רכישת דומיין", minutes: 10 }],
      },
      4
    );
    expect(wins).toHaveLength(4);
    expect(wins.map((w) => w.id)).toEqual([
      "log-income",
      "complete-profile",
      "upload-doc",
      "add-product",
    ]);
  });

  it("includes short tasks once data is complete", () => {
    const wins = buildQuickWins({
      ...base,
      shortTasks: [{ templateId: "buy-domain", title: "רכישת דומיין", minutes: 10 }],
    });
    expect(wins).toHaveLength(1);
    expect(wins[0].id).toBe("task:buy-domain");
    expect(wins[0].href).toBe("/tasks/buy-domain");
  });
});
