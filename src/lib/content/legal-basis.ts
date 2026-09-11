/**
 * What KIND of obligation each task is.
 *
 * Before this file, `priority` carried two unrelated ideas at once: how legally
 * serious a task is, and how urgent it is commercially. The result was that 28
 * of 70 templates were `critical` — including `pricing` and
 * `google-business-profile`, which no law requires — so "critical" told the user
 * nothing. Worse, `professional-liability-insurance` was `critical` with no
 * source at all, which reads as "the law requires this" for something that is
 * mandatory only in a few regulated professions.
 *
 * Legal basis is now declared separately and explicitly, and two invariants in
 * `invariants.test.ts` hold the line:
 *
 *   1. `priority: "critical"` is allowed ONLY on a `statute` task.
 *   2. Every `statute` task must cite at least one official link.
 *
 * So the product cannot claim something is legally required without saying which
 * authority says so. Every template id must appear here — a new template fails
 * the build until its basis is declared deliberately.
 *
 * Basis lives in one central map rather than on each template on purpose: it is
 * the claim most likely to be wrong, and the one a reviewer most needs to see
 * all at once.
 */

export type LegalBasis =
  /** A law or regulation imposes it. Skipping it is an offence, or carries a
   *  penalty, or makes the activity itself unlawful. */
  | "statute"
  /** The authority publishes this expectation, or the underlying rules are
   *  statutory but the task itself is elective. Not penalty-bearing on its own. */
  | "regulator_guidance"
  /** Professional consensus. It protects the business — sometimes a great deal —
   *  but no authority requires it. */
  | "best_practice"
  /** A growth or business decision. Not a duty in any sense. */
  | "commercial";

export const LEGAL_BASIS: Record<string, LegalBasis> = {
  // ---------------------------------------------------------------- statute --
  // Registration with the authorities: חוק מע"מ, פקודת מס הכנסה,
  // חוק הביטוח הלאומי, חוק החברות, פקודת השותפויות, חוק רישוי עסקים.
  "open-vat-file": "statute",
  "open-income-tax-file": "statute",
  "open-bituach-leumi-file": "statute",
  "register-company": "statute",
  "company-tax-files": "statute",
  "register-partnership": "statute",
  "business-license": "statute",
  "professional-certification": "statute",
  "food-hygiene-training": "statute",

  // Books, invoices and filings: הוראות ניהול ספרים, חשבוניות ישראל,
  // דיווח מע"מ תקופתי, דוח שנתי, מקדמות, אגרה שנתית לרשם.
  bookkeeping: "statute",
  "invoicing-software": "statute",
  "vat-reporting": "statute",
  "annual-tax-report": "statute",
  "company-annual-report-financials": "statute",
  "company-annual-fee": "statute",
  "partnership-annual-fee": "statute",
  "income-tax-advances": "statute",
  "withholding-certificate": "statute",
  // Crossing the עוסק פטור ceiling triggers a statutory duty to re-register.
  "patur-ceiling-watch": "statute",
  // הצהרת הון is a statutory return — but only once the authority demands it.
  "capital-statement-prep": "statute",

  // Pension for the self-employed — חוק פנסיה חובה לעצמאים, 2017.
  "mandatory-pension": "statute",

  // Employment. Each of these has a named source: חוק הודעה לעובד,
  // חוק שעות עבודה ומנוחה, חוק הגנת השכר, צו הרחבה לפנסיה חובה,
  // חוק חופשה שנתית / דמי מחלה / צו הרחבה להבראה, צו הרחבה לנסיעות.
  "employer-deductions-file": "statute",
  "employment-terms-notice": "statute",
  "attendance-tracking": "statute",
  "payroll-solution": "statute",
  "employee-pension-setup": "statute",
  "employee-rights-basics": "statute",
  "travel-reimbursement": "statute",

  // Digital regulation: תקנות שוויון זכויות לאנשים עם מוגבלות (תקן 5568),
  // חוק הגנת הפרטיות ותיקון 13, חוק התקשורת סעיף 30א (ספאם).
  "website-accessibility": "statute",
  "accessibility-statement": "statute",
  "privacy-policy": "statute",
  "database-registration-check": "statute",
  "spam-law-compliance": "statute",

  // Consumer protection: חוק הגנת הצרכן ותקנות ביטול עסקה.
  "shipping-returns-policy": "statute",

  // Safety duties on a construction site are statutory (תקנות הבטיחות בעבודה);
  // the contractor-works insurance half is usually contract- or tender-driven.
  "construction-insurance-safety": "statute",

  // ------------------------------------------------------ regulator guidance --
  // Cookie/tracking consent: Israel has no standalone cookie-banner statute.
  // The duty is inferred from the privacy law, and the Privacy Protection
  // Authority has published guidance — so this is guidance, not a cited statute.
  "cookies-banner": "regulator_guidance",
  // Vehicle-expense rules are statutory, but claiming them is elective.
  "vehicle-expenses": "regulator_guidance",

  // ---------------------------------------------------------- best practice --
  // Insurance. Professional-liability cover is compulsory only in a handful of
  // regulated professions, and employers-liability sits on top of the national
  // insurance work-injury cover rather than being required by law. Calling any
  // of these a legal duty would be a false claim.
  "professional-liability-insurance": "best_practice",
  "third-party-insurance": "best_practice",
  "employer-liability-insurance": "best_practice",
  "work-disability-insurance": "best_practice",

  // Contracts. A partnership is valid without a written agreement; website terms
  // and IP clauses protect you but are not imposed by anyone.
  "partnership-agreement": "best_practice",
  "client-agreement": "best_practice",
  "website-terms": "best_practice",
  "ip-usage-agreement": "best_practice",

  // Money hygiene. A separate account is not required by law for an עוסק; for a
  // company it is a practical consequence of separate legal personality, not a
  // statutory duty in itself.
  "business-bank-account": "best_practice",
  "company-bank-account": "best_practice",
  "choose-accountant": "best_practice",
  "cashflow-budget": "best_practice",
  "tax-money-aside": "best_practice",

  // Operations.
  "docs-backup": "best_practice",
  "crm-basic": "best_practice",
  "sales-process": "best_practice",
  "inventory-basics": "best_practice",
  "business-name-check": "best_practice",

  // A tax-advantaged savings product. Entirely elective.
  "keren-hishtalmut": "best_practice",

  // ------------------------------------------------------------- commercial --
  pricing: "commercial",
  "payment-solution": "commercial",
  "online-store-setup": "commercial",
  "google-business-profile": "commercial",
  "buy-domain": "commercial",
  "build-website": "commercial",
  "business-email": "commercial",
  "social-profiles": "commercial",
  "whatsapp-business": "commercial",
  "basic-branding": "commercial",
  "target-audience": "commercial",
  "digital-business-card": "commercial",
  "marketing-plan": "commercial",
  "reviews-mechanism": "commercial",
};

/**
 * The basis for a template. Falls back to `best_practice` — the honest default,
 * because it claims the least: it never tells a user that something is the law.
 * The invariant test makes the fallback unreachable in shipped content.
 */
export function legalBasisOf(templateId: string): LegalBasis {
  return LEGAL_BASIS[templateId] ?? "best_practice";
}

/** Short Hebrew label for the basis chip on a task. */
export const BASIS_LABEL: Record<LegalBasis, string> = {
  statute: "חובה על פי חוק",
  regulator_guidance: "הנחיית רשות",
  best_practice: "מומלץ מקצועית",
  commercial: "בחירה עסקית",
};

/** One sentence explaining what the label means, shown next to it. */
export const BASIS_EXPLAINER: Record<LegalBasis, string> = {
  statute: "חוק או תקנה מחייבים את זה. אי-עמידה עלולה לגרור קנס, עיצום או פעילות לא חוקית.",
  regulator_guidance:
    "הרשות מפרסמת את הציפייה הזאת, או שהכללים עצמם בחוק אבל המשימה עצמה אינה חובה.",
  best_practice: "אף רשות לא מחייבת את זה. זו המלצה מקצועית שמגנה על העסק.",
  commercial: "זו החלטה עסקית, לא חובה. היא כאן כי היא עוזרת לעסק לצמוח.",
};
