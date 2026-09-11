import { describe, expect, it } from "vitest";
import type { Obligation } from "./compliance";
import {
  certaintyOf,
  exposureOf,
  proximityOf,
  rankByExposure,
  severityOf,
  topExposure,
} from "./exposure";

function ob(over: Partial<Obligation> = {}): Obligation {
  return {
    id: "o1",
    kind: "vat",
    basis: "statutory",
    title: "דיווח מע\"מ",
    dueDate: "2026-09-15",
    templateId: "vat-reporting",
    daysUntil: 4,
    periodLabel: "יולי–אוגוסט 2026",
    ruleText: "…",
    sourceUrl: "https://www.gov.il/he/departments/israel_tax_authority",
    ...over,
  };
}

describe("severity comes from what the obligation IS", () => {
  it("a periodic statutory filing accrues a penalty", () => {
    expect(severityOf(ob({ kind: "vat", templateId: "vat-reporting" }))).toBe(
      "penalty_accruing"
    );
    expect(severityOf(ob({ kind: "advances", templateId: "income-tax-advances" }))).toBe(
      "penalty_accruing"
    );
    expect(
      severityOf(ob({ kind: "employer_deductions", templateId: "employer-monthly-102" }))
    ).toBe("penalty_accruing");
  });

  it("the registrar fee is a fixed step, not an accruing one", () => {
    // It changes to a higher tariff on 1 April and then stops changing. A model
    // that scored it like compounding interest would rank it like compounding
    // interest.
    expect(
      severityOf(ob({ kind: "registrar_fee", templateId: "company-annual-fee" }))
    ).toBe("penalty_fixed");
  });

  it("a statutory renewal or expiry blocks rather than fines", () => {
    // Severity is about the OBLIGATION (a lapsed business licence stops you
    // trading), while `basis` is about where the DATE came from. They are
    // separate axes on purpose: the date being a user-entered renewal does not
    // make an unlicensed business less unlicensed. The softer confidence in the
    // date shows up in certainty instead, not here.
    expect(severityOf(ob({ kind: "renewal", templateId: "business-license" }))).toBe(
      "blocking"
    );
    expect(
      severityOf(ob({ kind: "renewal", templateId: "business-license", basis: "renewal" }))
    ).toBe("blocking");
    expect(
      severityOf(ob({ kind: "document_expiry", templateId: "business-license" }))
    ).toBe("blocking");
  });

  it("but a renewal of something no law requires is only advisory", () => {
    // Renewing a professional-liability policy matters commercially; it is not
    // a legal duty for most professions, so it must not rank like one.
    expect(
      severityOf(ob({ kind: "renewal", templateId: "professional-liability-insurance" }))
    ).toBe("advisory");
  });

  it("anything that is not statute-backed is advisory, whatever its kind", () => {
    // This is the defect the whole model exists to fix: a marketing profile and
    // a missed VAT filing were treated as comparable.
    expect(severityOf(ob({ templateId: "google-business-profile" }))).toBe("advisory");
    expect(severityOf(ob({ templateId: "pricing", kind: "vat" }))).toBe("advisory");
  });
});

describe("proximity treats overdue as its own state", () => {
  it("overdue outranks everything upcoming", () => {
    // Overdue is not "extremely soon" — the consequence has already started.
    expect(proximityOf(-1)).toBeGreaterThan(proximityOf(0));
    expect(proximityOf(-1)).toBeGreaterThan(proximityOf(1));
  });

  it("and grows the longer it drags on, like the penalty does", () => {
    expect(proximityOf(-30)).toBeGreaterThan(proximityOf(-1));
    expect(proximityOf(-90)).toBeGreaterThan(proximityOf(-30));
  });

  it("is capped, so a very old debt cannot dominate for ever", () => {
    expect(proximityOf(-100000)).toBeLessThanOrEqual(1);
  });

  it("decreases monotonically as a deadline gets further away", () => {
    const days = [0, 3, 7, 10, 14, 20, 30, 60, 90, 200];
    for (let i = 1; i < days.length; i++) {
      expect(proximityOf(days[i]), `${days[i]} vs ${days[i - 1]}`).toBeLessThanOrEqual(
        proximityOf(days[i - 1])
      );
    }
  });

  it("gives a distant obligation almost no weight", () => {
    // So next April's annual return cannot crowd out next week's VAT filing.
    expect(proximityOf(220)).toBeLessThan(0.1);
  });
});

describe("certainty keeps guesses from outranking citable law", () => {
  it("a sourced statutory rule is fully certain", () => {
    expect(certaintyOf(ob())).toBe(1);
  });

  it("a statutory rule with no citation is less certain", () => {
    expect(certaintyOf(ob({ sourceUrl: null }))).toBeLessThan(1);
  });

  it("a recommended date is the least certain of all", () => {
    // These come from "+N days from when the plan was built", which is a
    // suggestion, not a rule.
    expect(certaintyOf(ob({ basis: "renewal" }))).toBeLessThan(
      certaintyOf(ob({ sourceUrl: null }))
    );
  });
});

describe("ranking by what it will actually cost", () => {
  it("an overdue VAT filing outranks a nearer marketing task", () => {
    // The exact inversion the old ordering produced: it sorted by days until
    // due, so a soon-but-harmless item beat an overdue penalty.
    const ranked = rankByExposure([
      ob({
        id: "marketing",
        kind: "renewal",
        basis: "renewal",
        templateId: "google-business-profile",
        title: "פרופיל גוגל",
        daysUntil: 0,
      }),
      ob({ id: "vat", daysUntil: -5, title: "דיווח מע\"מ" }),
    ]);
    expect(ranked[0].obligationId).toBe("vat");
  });

  it("a distant annual return does not outrank an imminent filing", () => {
    const ranked = rankByExposure([
      ob({ id: "annual", kind: "annual_report", templateId: "annual-tax-report", daysUntil: 210 }),
      ob({ id: "vat", daysUntil: 3 }),
    ]);
    expect(ranked[0].obligationId).toBe("vat");
  });

  it("an accruing penalty outranks a fixed one at the same distance", () => {
    const ranked = rankByExposure([
      ob({ id: "fee", kind: "registrar_fee", templateId: "company-annual-fee", daysUntil: 5 }),
      ob({ id: "vat", daysUntil: 5 }),
    ]);
    expect(ranked[0].obligationId).toBe("vat");
  });

  it("is stable — ties break on the due date, not on input order", () => {
    const a = ob({ id: "a", dueDate: "2026-09-20", daysUntil: 9 });
    const b = ob({ id: "b", dueDate: "2026-09-15", daysUntil: 9 });
    expect(rankByExposure([a, b])[0].obligationId).toBe("b");
    expect(rankByExposure([b, a])[0].obligationId).toBe("b");
  });

  it("explains itself — every item names its consequence", () => {
    for (const item of rankByExposure([ob(), ob({ id: "x", templateId: "pricing" })])) {
      expect(item.consequence.length).toBeGreaterThan(20);
    }
  });
});

describe("topExposure", () => {
  it("returns the worst item when something genuinely matters", () => {
    const top = topExposure([ob({ daysUntil: -3 }), ob({ id: "o2", daysUntil: 40 })]);
    expect(top?.daysUntil).toBe(-3);
  });

  it("returns null rather than promoting something irrelevant", () => {
    // "Nothing much matters right now" is an honest answer. Surfacing the
    // least-irrelevant item to look busy is how a product teaches users to
    // ignore its alerts.
    const distantAdvisory = ob({
      templateId: "google-business-profile",
      basis: "renewal",
      daysUntil: 300,
    });
    expect(topExposure([distantAdvisory])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(topExposure([])).toBeNull();
  });
});

describe("the score itself", () => {
  it("is the product of its three factors", () => {
    const e = exposureOf(ob());
    expect(e.score).toBeCloseTo(1 * e.proximity * e.certainty, 10);
  });

  it("never exceeds 1, so it cannot be mistaken for a percentage", () => {
    for (const daysUntil of [-1000, -1, 0, 5, 100, 1000]) {
      expect(exposureOf(ob({ daysUntil })).score).toBeLessThanOrEqual(1);
    }
  });
});
