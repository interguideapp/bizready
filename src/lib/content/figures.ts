import { YEARLY_FIGURES } from "@/lib/types";

/**
 * Every number in the content that changes with the tax year, in one place —
 * with the year it belongs to and the official page it was read from.
 *
 * The problem this solves: `YEARLY_FIGURES` had thirteen entries and only two
 * readers. The real numbers were typed into Hebrew prose as literals — ₪122,833
 * four times, "23%" five times, each registrar fee three or four times. So next
 * January someone would update the config object and *nothing the user reads
 * would change*. `tasks-entities.ts` even carried the comment "Figures are 2026
 * (see YEARLY_FIGURES)" above prose containing the hardcoded values, pointing at
 * a constant the file never imported.
 *
 * Now content writes `{{registrarAnnualFeeReduced}}` and the number is resolved
 * at render, with a year stamp and a source behind it. `figures.test.ts` fails
 * the build if any of these values reappears as a literal in template prose, so
 * the drift cannot come back.
 *
 * `source` is the page the value was read from. Every URL here is already cited
 * in the content that uses the figure — nothing invented for this table.
 */

export type FigureKind =
  /** shekels, shown as ₪12,345 */
  | "ils"
  /** a percentage, shown as 23% */
  | "percent";

export interface Figure {
  value: number;
  /** The tax year this value belongs to. Shown wherever the figure is explained. */
  year: number;
  kind: FigureKind;
  /** Hebrew name of the figure, for the review queue and any "what is this" UI. */
  label: string;
  /** The official page the value was read from. */
  source: string;
}

const TAX_AUTHORITY = "https://www.gov.il/he/departments/israel_tax_authority";
const REGISTRAR_ANNUAL = "https://www.gov.il/he/service/company_partnership_annual_payment";
const COMPANY_REGISTRATION = "https://www.gov.il/he/service/company_registration";
const PARTNERSHIP_REGISTRAR =
  "https://www.gov.il/he/departments/topics/registrar_of_partnerships/govil-landing-page";
const EXEMPT_DEALER = "https://www.gov.il/he/service/request-open-exempt-dealer-via-internet";
const BTL_SELF_EMPLOYED =
  "https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/howtoregister.aspx";

const YEAR = YEARLY_FIGURES.year;

export const FIGURES = {
  osekPaturCeiling: {
    value: YEARLY_FIGURES.osekPaturCeiling,
    year: YEAR,
    kind: "ils",
    label: "תקרת מחזור לעוסק פטור",
    source: EXEMPT_DEALER,
  },
  invoiceAllocationThreshold: {
    value: YEARLY_FIGURES.invoiceAllocationThreshold,
    year: YEAR,
    kind: "ils",
    label: "סף חובת מספר הקצאה (חשבוניות ישראל)",
    source: TAX_AUTHORITY,
  },
  averageWage: {
    value: YEARLY_FIGURES.averageWage,
    year: YEAR,
    kind: "ils",
    label: "השכר הממוצע במשק",
    source: BTL_SELF_EMPLOYED,
  },
  corporateTaxRate: {
    value: YEARLY_FIGURES.corporateTaxRate,
    year: YEAR,
    kind: "percent",
    label: "שיעור מס חברות",
    source: TAX_AUTHORITY,
  },
  companyRegistrationFee: {
    value: YEARLY_FIGURES.companyRegistrationFee,
    year: YEAR,
    kind: "ils",
    label: "אגרת רישום חברה — הגשה רגילה",
    source: COMPANY_REGISTRATION,
  },
  companyRegistrationFeeOnline: {
    value: YEARLY_FIGURES.companyRegistrationFeeOnline,
    year: YEAR,
    kind: "ils",
    label: "אגרת רישום חברה — הגשה מקוונת",
    source: COMPANY_REGISTRATION,
  },
  registrarAnnualFeeReduced: {
    value: YEARLY_FIGURES.registrarAnnualFeeReduced,
    year: YEAR,
    kind: "ils",
    label: "אגרה שנתית לרשם החברות — מופחתת (עד 31.3)",
    source: REGISTRAR_ANNUAL,
  },
  registrarAnnualFeeRegular: {
    value: YEARLY_FIGURES.registrarAnnualFeeRegular,
    year: YEAR,
    kind: "ils",
    label: "אגרה שנתית לרשם החברות — רגילה",
    source: REGISTRAR_ANNUAL,
  },
  partnershipRegistrationGeneral: {
    value: YEARLY_FIGURES.partnershipRegistrationGeneral,
    year: YEAR,
    kind: "ils",
    label: "אגרת רישום שותפות כללית",
    source: PARTNERSHIP_REGISTRAR,
  },
  partnershipRegistrationLimited: {
    value: YEARLY_FIGURES.partnershipRegistrationLimited,
    year: YEAR,
    kind: "ils",
    label: "אגרת רישום שותפות מוגבלת",
    source: PARTNERSHIP_REGISTRAR,
  },
  partnershipAnnualFeeReduced: {
    value: YEARLY_FIGURES.partnershipAnnualFeeReduced,
    year: YEAR,
    kind: "ils",
    label: "אגרה שנתית לרשם השותפויות — מופחתת (עד 31.3)",
    source: REGISTRAR_ANNUAL,
  },
  partnershipAnnualFeeRegular: {
    value: YEARLY_FIGURES.partnershipAnnualFeeRegular,
    year: YEAR,
    kind: "ils",
    label: "אגרה שנתית לרשם השותפויות — רגילה",
    source: REGISTRAR_ANNUAL,
  },
} as const satisfies Record<string, Figure>;

/**
 * Deliberately absent: the default withholding rate applied to a supplier with
 * no valid אישור ניכוי מס במקור. It sat in YEARLY_FIGURES as
 * `withholdingDefaultRate: 20` with no reader anywhere, and it has been removed
 * rather than wired in.
 *
 * The reason is the same standard the rest of this file enforces: a rate that
 * determines how much money one business must hold back from another is a legal
 * claim, and this one was never verified against an official source. Publishing
 * it because it happened to be in the codebase would be exactly the confident,
 * unsourced assertion these tests exist to prevent. It belongs in the sourced
 * research pass on the payer side of withholding, alongside the missing employer
 * filings (טופס 102 / 126 / 856) — not in prose before then.
 */

export type FigureKey = keyof typeof FIGURES;

/** The figure as it appears in prose: ₪122,833 or 23%. */
export function formatFigure(key: FigureKey): string {
  const f = FIGURES[key];
  // he-IL grouping, and the ₪ leads here because that is how these amounts are
  // written in the official Hebrew sources this content mirrors.
  return f.kind === "percent"
    ? `${f.value}%`
    : `₪${f.value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

/** `{{figureKey}}` in content prose. */
const TOKEN = /\{\{([a-zA-Z]+)\}\}/g;

/**
 * Replaces `{{figureKey}}` tokens with the current formatted value.
 *
 * An unknown token is left exactly as written rather than blanked. A visible
 * `{{typo}}` in the UI is an obvious bug someone fixes; a silently empty
 * sentence where an amount should be ("the reduced fee is  until 31 March") is a
 * compliance statement with the number quietly removed, which is worse.
 * `figures.test.ts` fails the build on any unknown token, so neither ships.
 */
export function interpolateFigures(text: string): string {
  return text.replace(TOKEN, (whole, key: string) =>
    key in FIGURES ? formatFigure(key as FigureKey) : whole
  );
}

/** Every `{{token}}` used in a string, known or not. For the build-time check. */
export function figureTokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}

/** The year stamp shown next to interpolated amounts, e.g. "נכון ל-2026". */
export const FIGURES_YEAR = YEAR;
