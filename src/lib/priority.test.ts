import { describe, expect, it } from "vitest";
import { computeAttention, type AttentionObligation } from "./priority";
import type { JourneyNode } from "./journey";

function node(partial: Partial<JourneyNode> & { templateId: string }): JourneyNode {
  return {
    title: partial.templateId,
    categoryId: "x",
    priority: "recommended",
    state: "available",
    blockedBy: [],
    unlocks: [],
    ...partial,
  };
}

const today = "2026-09-20";

describe("computeAttention", () => {
  it("does not raise 'urgent' for a far-off obligation", () => {
    const obs: AttentionObligation[] = [
      { templateId: "annual-tax-report", title: "דוח שנתי", dueDate: "2027-04-30", daysUntil: 220, basis: "statutory", periodLabel: null },
    ];
    const a = computeAttention(obs, [node({ templateId: "pricing", priority: "critical" })], new Map(), today);
    expect(a.urgent).toBeNull(); // 220 days away → not urgent now
  });

  it("raises the overdue statutory filing as most urgent", () => {
    const obs: AttentionObligation[] = [
      { templateId: "vat-reporting", title: "מע\"מ", dueDate: "2026-09-10", daysUntil: -10, basis: "statutory", periodLabel: "יולי–אוגוסט" },
      { templateId: "annual-tax-report", title: "שנתי", dueDate: "2027-04-30", daysUntil: 220, basis: "statutory", periodLabel: null },
    ];
    const a = computeAttention(obs, [], new Map(), today);
    expect(a.urgent?.templateId).toBe("vat-reporting");
  });

  it("picks the most important AVAILABLE task as next — critical over recommended, and not the urgent one", () => {
    const obs: AttentionObligation[] = [
      { templateId: "vat-reporting", title: "מע\"מ", dueDate: "2026-09-25", daysUntil: 5, basis: "statutory", periodLabel: null },
    ];
    const nodes = [
      node({ templateId: "vat-reporting", priority: "critical", state: "available" }),
      node({ templateId: "pricing", priority: "critical", state: "available", unlocks: ["a", "b"] }),
      node({ templateId: "social-profiles", priority: "recommended", state: "available" }),
      node({ templateId: "locked-one", priority: "critical", state: "locked" }),
    ];
    const a = computeAttention(obs, nodes, new Map(), today);
    // vat-reporting is the urgent one → excluded; pricing (critical + unlocks) beats recommended; locked excluded
    expect(a.nextTemplateId).toBe("pricing");
  });
});
