import { describe, expect, it } from "vitest";
import {
  DOC_GENERATORS,
  GENERATOR_BY_TEMPLATE,
  GENERATORS_BY_ID,
  renderDocHtml,
  type GeneratorContext,
} from "./generators";

const ctx: GeneratorContext = {
  businessName: "הסטודיו של דנה",
  entityType: "osek_murshe",
  dealerNumber: "123456789",
  field: "beauty_care",
  answers: {
    collects_personal_data: true,
    plans_employees: true,
    has_website: true,
    product_type: "physical_products",
    sales_channel: "both",
  },
  today: new Date("2026-09-01T00:00:00Z"),
};

describe("document generators", () => {
  it("every generator builds a document with the business name and disclaimer", () => {
    for (const gen of DOC_GENERATORS) {
      const doc = gen.build(ctx);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.disclaimer).toContain("ייעוץ משפטי");
      // the business identity appears somewhere in the document
      const blob = [doc.intro ?? "", ...doc.sections.flatMap((s) => s.paragraphs)].join(
        " "
      );
      expect(blob).toContain("הסטודיו של דנה");
    }
  });

  it("privacy policy references תיקון 13 rights", () => {
    const doc = GENERATORS_BY_ID.get("privacy-policy")!.build(ctx);
    const blob = doc.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(blob).toMatch(/עיון|תיקון|מחיקת/);
  });

  it("maps each generator to its task template", () => {
    expect(GENERATOR_BY_TEMPLATE.get("privacy-policy")?.id).toBe("privacy-policy");
    expect(GENERATOR_BY_TEMPLATE.get("employment-terms-notice")?.id).toBe(
      "employment-terms-notice"
    );
  });

  it("gates employee notice on actually planning employees", () => {
    const gen = GENERATORS_BY_ID.get("employment-terms-notice")!;
    expect(gen.isRelevant!({ ...ctx, answers: { plans_employees: true } })).toBe(true);
    expect(gen.isRelevant!({ ...ctx, answers: { plans_employees: false } })).toBe(
      false
    );
  });

  it("website terms adds a shipping/returns section only for physical products", () => {
    const gen = GENERATORS_BY_ID.get("website-terms")!;
    const physical = gen
      .build({ ...ctx, answers: { product_type: "physical_products" } })
      .sections.some((s) => s.heading?.includes("משלוחים"));
    const services = gen
      .build({ ...ctx, answers: { product_type: "services" } })
      .sections.some((s) => s.heading?.includes("משלוחים"));
    expect(physical).toBe(true);
    expect(services).toBe(false);
  });

  it("renders self-contained, escaped HTML", () => {
    const doc = GENERATORS_BY_ID.get("client-agreement")!.build({
      ...ctx,
      businessName: 'עסק <script>"',
    });
    const html = renderDocHtml(doc, 'עסק <script>"');
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('dir="rtl"');
    // the dangerous characters are escaped, not injected as tags
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
