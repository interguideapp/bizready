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
  /**
   * A fixed calendar date each year. `month` is 1-12.
   *
   * `announced` carries the dates the authority has actually published for a
   * given TAX year, keyed by that tax year. It exists because the annual return
   * is not really a fixed date: רשות המסים announces an extension each spring
   * under its arrangement with the representatives, and the published date has
   * moved year to year (tax year 2021 was due 30.6.2022; 2024 was 31.7.2025;
   * 2025 is 31.7.2026). Showing the bare statutory date to a company would be
   * three months early every year.
   *
   * When a tax year is not in the map we show NO date rather than guessing —
   * the task explains that the date is announced in the spring. An invented
   * deadline on the largest penalty exposure in the product is worse than an
   * honest "not published yet".
   */
  | {
      anchor: "annual";
      month: number;
      day: number;
      announced?: Record<number, string>;
      /** True when an unannounced year must show nothing at all. */
      announcedOnly?: boolean;
    }
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
   * דוח מס שנתי לחברה (טופס 1214) plus the audited financials.
   *
   * The audit flagged this as one of the largest penalty exposures with no
   * anchored date, and my first pass left it out because I could not source a
   * single defensible date. The research showed why: there isn't one. רשות
   * המסים publishes the date per tax year under its arrangement with the
   * representatives, and it has moved — tax year 2021 was due 30.6.2022, 2024
   * was 31.7.2025, and 2025 is 31.7.2026 (announced 23 April 2026).
   *
   * So the rule is announced-only: the published dates are listed, and a tax
   * year with no published date yields no deadline instead of a guess. That is
   * the honest model, and it is better than both omitting the obligation and
   * inventing a calendar rule for it.
   */
  "company-annual-report-financials": {
    kind: "annual_report",
    rule: {
      anchor: "annual",
      // The statutory base under the פקודה, kept for reference; announcedOnly
      // means it is never shown on its own.
      month: 4,
      day: 30,
      announced: {
        2024: "2025-07-31",
        2025: "2026-07-31",
      },
      announcedOnly: true,
    },
    source: "https://www.gov.il/he/departments/topics/annual-reports-1214/govil-landing-page",
    verified: VERIFIED,
    periodNoun: "שנת המס",
    note: "רשות המסים מפרסמת את המועד לכל שנת מס, בדרך כלל באביב, ובייצוג רו\"ח נהוגות ארכות נוספות לפי ההסדר עם המייצגים. כל עוד המועד לשנה הנוכחית לא פורסם — לא נמציא תאריך.",
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

/**
 * The published date for a tax year, if the authority has announced one.
 *
 * Returns null when it has not, which the caller must treat as "no deadline to
 * show" rather than falling back to the statutory date — see the note on the
 * annual anchor.
 */
export function announcedDateFor(rule: DateRule, taxYear: number): string | null {
  if (rule.anchor !== "annual") return null;
  return rule.announced?.[taxYear] ?? null;
}

/**
 * The next published deadline that has not yet passed, with the tax year it
 * covers.
 *
 * Derived by scanning the published dates rather than by computing a tax year
 * from the calendar. That distinction matters: the statutory base date rolls
 * forward once it passes, which shifts the derived year by one — so on 1 May
 * 2026 a calendar derivation lands on tax year 2026 when the return actually
 * open is 2025. Reading the published map directly cannot make that mistake.
 */
export function nextAnnouncedFiling(
  rule: DateRule,
  todayIso: string
): { taxYear: number; dueIso: string } | null {
  if (rule.anchor !== "annual" || !rule.announced) return null;
  const upcoming = Object.entries(rule.announced)
    .map(([taxYear, dueIso]) => ({ taxYear: Number(taxYear), dueIso }))
    .filter((entry) => entry.dueIso >= todayIso)
    .sort((a, b) => a.dueIso.localeCompare(b.dueIso));
  return upcoming[0] ?? null;
}
