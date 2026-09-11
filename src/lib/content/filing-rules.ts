/**
 * Where every statutory date comes from — one record per obligation, each
 * declaring its anchor, the sentence that explains it, the official page it was
 * read from, and the date somebody actually checked it.
 *
 * Two problems this replaces.
 *
 * First, the dates were three hardcoded `if (task.template_id === ...)` blocks
 * inside compliance.ts. Adding an obligation meant adding a branch, which is why
 * the product shipped with only three dated filings while a company's annual
 * return, the registrar fees, הצהרת הון and every employer filing had no
 * anchored date at all.
 *
 * Second, and worse: the explanation could contradict the date it explained. The
 * VAT rule text said "מקוון — עד ה-19" beside a date computed for the 15th, and
 * the annual-report text said "עד סוף מאי" beside a date of 30 April. The
 * product's whole claim is "a date you can see the reasoning behind", so an
 * explanation that disagrees with its own date is worse than no explanation.
 * Here the sentence is generated FROM the rule, so the two cannot drift, and
 * `filing-rules.test.ts` asserts every explanation contains the date it explains.
 *
 * EVERY rule below was verified against the cited official page on the
 * `verified` date. Nothing here is from memory. Where I could not source a date,
 * there is no rule — see the note at the bottom of this file.
 */

export type ObligationKindId =
  | "vat"
  | "advances"
  | "annual_report"
  | "employer_deductions"
  | "registrar_fee";

export type DateRule =
  /**
   * Filed by day N of the month following the reporting period, where the
   * period length comes from the business's own reporting frequency
   * (monthly or bimonthly). VAT and income-tax advances.
   */
  | { anchor: "period_plus"; day: number }
  /** Day N of every month, covering the previous calendar month. */
  | { anchor: "monthly"; day: number }
  /** A fixed calendar date each year. `month` is 1-12. */
  | { anchor: "annual"; month: number; day: number }
  /**
   * N days from a demand we cannot see. There is no computable date, so these
   * obligations never appear as a deadline and never as overdue — the product
   * explains the rule and waits for the user to tell it the demand date.
   */
  | { anchor: "on_demand"; days: number };

export interface FilingRule {
  kind: ObligationKindId;
  rule: DateRule;
  /** The official page this rule was read from. */
  source: string;
  /** When a human last checked this rule against that page. */
  verified: string;
  /**
   * What the period is called in the explanation, e.g. "התקופה" / "החודש".
   * Kept here so the sentence reads naturally per obligation.
   */
  periodNoun: string;
  /** Anything the official page says that the date alone does not convey. */
  note?: string;
}

const ITA_126_856 = "https://www.gov.il/he/service/report126";
const ITA_ANNUAL = "https://www.gov.il/he/departments/israel_tax_authority";
const BTL_EMPLOYER_102 =
  "https://www.btl.gov.il/Insurance/Maasik/MToshavYisrael/DivuahVetashlum/Pages/Divuhach.aspx";
const BTL_SELF_EMPLOYED_PAY =
  "https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/howtopay.aspx";
const BTL_126 = "https://www.btl.gov.il/Insurance/Maasik/Pages/Tofes126.aspx";
const REGISTRAR_ANNUAL_FEE =
  "https://www.gov.il/he/service/company_partnership_annual_payment";

/** The date this research pass verified every rule below. */
const VERIFIED = "2026-09-11";

export const FILING_RULES: Record<string, FilingRule> = {
  // ---------------------------------------------------------------- existing --
  "vat-reporting": {
    kind: "vat",
    rule: { anchor: "period_plus", day: 15 },
    source: ITA_ANNUAL,
    verified: VERIFIED,
    periodNoun: "התקופה",
  },
  "income-tax-advances": {
    kind: "advances",
    rule: { anchor: "period_plus", day: 15 },
    source: ITA_ANNUAL,
    verified: VERIFIED,
    periodNoun: "התקופה",
  },
  "annual-tax-report": {
    kind: "annual_report",
    rule: { anchor: "annual", month: 4, day: 30 },
    source: ITA_ANNUAL,
    verified: VERIFIED,
    periodNoun: "שנת המס",
  },

  // --------------------------------------------------------------------- new --
  /**
   * מקדמות ביטוח לאומי לעצמאי. The product had NOTHING for this — a monthly
   * payment every self-employed person owes, with no task and no date.
   *
   * And the date is not the one you would guess: ביטוח לאומי collects on the
   * 22nd, a week after the tax authority's 15th. Assuming the 15th would have
   * been wrong every month.
   */
  "bituach-leumi-advances": {
    kind: "advances",
    rule: { anchor: "monthly", day: 22 },
    source: BTL_SELF_EMPLOYED_PAY,
    verified: VERIFIED,
    periodNoun: "החודש",
    note: 'ביטוח לאומי מציין שהתאריך עשוי לזוז בשל שבתות וחגים — אם ה-22 נופל בשבת, התשלום נדחה ליום ראשון.',
  },
  /**
   * טופס 102 — the monthly employer deduction report, to both מס הכנסה and
   * ביטוח לאומי. Also completely absent before: the product told employers to
   * open a ניכויים file and then never mentioned the monthly filing that file
   * exists for.
   */
  "employer-monthly-102": {
    kind: "employer_deductions",
    rule: { anchor: "monthly", day: 15 },
    source: BTL_EMPLOYER_102,
    verified: VERIFIED,
    periodNoun: "החודש",
  },
  /** טופס 126 / 856 — the annual withholding reports. */
  "employer-annual-126": {
    kind: "annual_report",
    rule: { anchor: "annual", month: 4, day: 30 },
    source: ITA_126_856,
    verified: VERIFIED,
    periodNoun: "שנת המס",
    note: 'ביטוח לאומי דורש 126 גם באמצע השנה: עד 18 ביולי עבור ינואר–יוני, ועד 18 בינואר עבור השנה שקדמה.',
  },
  /**
   * אגרה שנתית לרשם החברות / השותפויות. Both templates existed and said
   * "31 March" in prose, but nothing computed it — so the one date in the
   * product that is a hard cliff (the fee jumps on 1 April) never reminded
   * anyone.
   */
  "company-annual-fee": {
    kind: "registrar_fee",
    rule: { anchor: "annual", month: 3, day: 31 },
    source: REGISTRAR_ANNUAL_FEE,
    verified: VERIFIED,
    periodNoun: "השנה",
    note: "אחרי 31.3 האגרה עולה לתעריף הרגיל. זה לא קנס — זה פשוט תעריף אחר, ואי-תשלום מצטבר לחוב.",
  },
  "partnership-annual-fee": {
    kind: "registrar_fee",
    rule: { anchor: "annual", month: 3, day: 31 },
    source: REGISTRAR_ANNUAL_FEE,
    verified: VERIFIED,
    periodNoun: "השנה",
    note: "אחרי 31.3 האגרה עולה לתעריף הרגיל.",
  },
  /**
   * הצהרת הון. Demand-triggered, so there is no date to compute until the
   * demand arrives — which is exactly why it shipped with `due_date: null` and
   * no explanation. Declaring the rule lets the product say the real thing:
   * 120 days from the day you receive the demand.
   */
  "capital-statement-prep": {
    kind: "annual_report",
    rule: { anchor: "on_demand", days: 120 },
    source: "https://www.gov.il/he/service/itc1219",
    verified: VERIFIED,
    periodNoun: "הדרישה",
    note: "פקיד השומה דורש את ההצהרה (סעיף 135 לפקודת מס הכנסה); מרגע קבלת הדרישה יש 120 ימים.",
  },
};

/**
 * The filings that can be dated, and therefore the only ones that may ever show
 * as overdue. `on_demand` rules are deliberately excluded: we cannot see the
 * demand, so calling one "late" would be a fabricated deadline — the exact
 * failure this whole pass exists to remove.
 *
 * compliance.ts derives STATUTORY_FILINGS from this, so the set can no longer
 * drift from the rules that date it. It used to be written out twice, by hand,
 * in compliance.ts and gamification.ts.
 */
export const DATED_FILING_IDS: string[] = Object.entries(FILING_RULES)
  .filter(([, r]) => r.rule.anchor !== "on_demand")
  .map(([id]) => id);

export function filingRuleFor(templateId: string): FilingRule | null {
  return FILING_RULES[templateId] ?? null;
}

/**
 * NOT in this registry, deliberately:
 *
 * - `company-annual-report-financials` — a company's annual return (טופס 1214)
 *   plus audited financials and the registrar's annual return. The audit
 *   correctly flags this as one of the largest penalty exposures with no
 *   anchored date. I could not establish a single defensible date from an
 *   official source in this pass: the filing runs through the רשות המסים
 *   "הסדר" arrangement with representative-dependent extensions, so any date I
 *   picked would be a guess dressed as a rule. It keeps its recommended date
 *   and its prose, and stays on the research list.
 *
 * - `withholding-certificate` renewal — the certificate's validity period drives
 *   it, and that is per-business data we do not hold. Better handled by the
 *   renewal-date capture path than by a guessed calendar rule.
 *
 * - טופס 856 has the same 30 April deadline as 126 and is covered by the
 *   employer-annual-126 template's content rather than a separate rule, because
 *   who must file 856 depends on whether the business withholds from suppliers —
 *   a fact onboarding does not currently ask. Inventing that gate would put a
 *   filing duty in front of people who do not have it.
 */
