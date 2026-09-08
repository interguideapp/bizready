import { describe, expect, it } from "vitest";
import { computeConfidence } from "./confidence";

describe("computeConfidence", () => {
  it("is at_risk when a statutory filing is overdue", () => {
    const c = computeConfidence({
      overdueStatutory: 2,
      urgent: { templateId: "vat-reporting", title: "דיווח מע\"מ", daysUntil: -5 },
      next: null,
      remainingCritical: 4,
    });
    expect(c.state).toBe("at_risk");
    expect(c.realRisks).toBe(2);
    expect(c.headline).toContain("2");
    expect(c.theOneThing?.templateId).toBe("vat-reporting");
  });

  it("is on_track with the next move when nothing is overdue", () => {
    const c = computeConfidence({
      overdueStatutory: 0,
      urgent: null,
      next: { templateId: "open-vat-file", title: "פתיחת תיק עוסק במע\"מ" },
      remainingCritical: 5,
    });
    expect(c.state).toBe("on_track");
    expect(c.realRisks).toBe(0);
    expect(c.detail).toContain("פתיחת תיק עוסק");
    expect(c.theOneThing?.templateId).toBe("open-vat-file");
  });

  it("prefers the urgent dated item over the next task for the one thing", () => {
    const c = computeConfidence({
      overdueStatutory: 0,
      urgent: { templateId: "vat-reporting", title: "דיווח מע\"מ", daysUntil: 3 },
      next: { templateId: "pricing", title: "תמחור" },
      remainingCritical: 3,
    });
    expect(c.theOneThing?.templateId).toBe("vat-reporting");
    expect(c.detail).toContain("בעוד 3 ימים");
  });

  it("is covered when nothing is overdue, pressing, or critically open", () => {
    const c = computeConfidence({
      overdueStatutory: 0,
      urgent: null,
      next: null,
      remainingCritical: 0,
    });
    expect(c.state).toBe("covered");
    expect(c.theOneThing).toBeNull();
  });
});
