import { describe, expect, it } from "vitest";
import { sanitizeAnswers, sanitizeBusinessName } from "./validate-answers";
import { isStatutoryFiling } from "./compliance";

describe("sanitizeAnswers — already_done is a security boundary", () => {
  it("strips ids the wizard never offers, including every statutory filing", () => {
    const a = sanitizeAnswers({
      entity_type: "osek_murshe",
      already_done: [
        "vat-reporting",
        "income-tax-advances",
        "annual-tax-report",
        "open-vat-file", // legitimately offered
      ],
    });
    // the crafted statutory ids are gone
    expect(a.already_done.some(isStatutoryFiling)).toBe(false);
    expect(a.already_done).toEqual(["open-vat-file"]);
  });

  it("drops unknown ids, non-strings and duplicates", () => {
    const a = sanitizeAnswers({
      already_done: ["open-vat-file", "open-vat-file", "not-a-real-task", 42, null],
    });
    expect(a.already_done).toEqual(["open-vat-file"]);
  });

  it("defaults already_done to empty when it isn't an array", () => {
    expect(sanitizeAnswers({ already_done: "everything" }).already_done).toEqual([]);
    expect(sanitizeAnswers({}).already_done).toEqual([]);
  });
});

describe("sanitizeAnswers — enum coercion", () => {
  it("falls back to safe defaults for unknown enum values", () => {
    const a = sanitizeAnswers({
      entity_type: "megacorp",
      field: "crime",
      expected_revenue: "billions",
      product_type: "vibes",
    });
    expect(a.entity_type).toBe("osek_patur");
    expect(a.field).toBe("other");
    expect(a.expected_revenue).toBe("under_60k");
    expect(a.product_type).toBe("services");
  });

  it("coerces non-boolean flags rather than trusting them", () => {
    const a = sanitizeAnswers({ has_website: "yes", plans_employees: 1 });
    expect(a.has_website).toBe(false);
    expect(a.plans_employees).toBe(false);
  });

  it("defaults wants_marketing to true (the documented legacy default)", () => {
    expect(sanitizeAnswers({}).wants_marketing).toBe(true);
    expect(sanitizeAnswers({ wants_marketing: false }).wants_marketing).toBe(false);
  });

  it("only carries vat_frequency where VAT is reported periodically", () => {
    expect(sanitizeAnswers({ entity_type: "osek_patur", vat_frequency: "monthly" }).vat_frequency)
      .toBeUndefined();
    expect(sanitizeAnswers({ entity_type: "osek_murshe", vat_frequency: "monthly" }).vat_frequency)
      .toBe("monthly");
    expect(sanitizeAnswers({ entity_type: "company" }).vat_frequency).toBe("bimonthly");
    // an invalid frequency falls back rather than reaching the date engine
    expect(sanitizeAnswers({ entity_type: "company", vat_frequency: "hourly" }).vat_frequency)
      .toBe("bimonthly");
  });
});

describe("sanitizeBusinessName", () => {
  it("trims, requires content, and caps length", () => {
    expect(sanitizeBusinessName("  סטודיו אורי  ")).toBe("סטודיו אורי");
    expect(() => sanitizeBusinessName("   ")).toThrow();
    expect(() => sanitizeBusinessName(undefined)).toThrow();
    expect(sanitizeBusinessName("x".repeat(500)).length).toBe(120);
  });
});
