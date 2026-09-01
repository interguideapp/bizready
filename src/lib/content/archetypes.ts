import type { TaskArchetype } from "@/lib/types";

/**
 * Every task maps to exactly one real-world workflow archetype, which decides
 * the purpose-built experience rendered on its page. Kept as an explicit map so
 * the assignment is deliberate and auditable; anything unlisted falls back to
 * "routine" (set up an ongoing habit).
 */
const ARCHETYPE_BY_ID: Record<string, TaskArchetype> = {
  // 1 · registration — open a file / obtain an official record
  "open-vat-file": "registration",
  "open-income-tax-file": "registration",
  "open-bituach-leumi-file": "registration",
  "employer-deductions-file": "registration",
  "withholding-certificate": "registration",

  // 2 · filing — recurring statutory report + payment
  "vat-reporting": "filing",
  "income-tax-advances": "filing",
  "annual-tax-report": "filing",

  // 3 · decision — check whether an obligation applies, then act
  "business-license": "decision",
  "professional-certification": "decision",
  "business-name-check": "decision",
  "database-registration-check": "decision",
  "food-hygiene-training": "decision",
  "spam-law-compliance": "decision",
  "cookies-banner": "decision",
  "website-accessibility": "decision",

  // 4 · provider — choose a provider / set up a service
  "choose-accountant": "provider",
  "invoicing-software": "provider",
  "business-bank-account": "provider",
  "payment-solution": "provider",
  "mandatory-pension": "provider",
  "keren-hishtalmut": "provider",
  "professional-liability-insurance": "provider",
  "third-party-insurance": "provider",
  "work-disability-insurance": "provider",
  "payroll-solution": "provider",
  "employee-pension-setup": "provider",
  "employer-liability-insurance": "provider",
  "construction-insurance-safety": "provider",
  "attendance-tracking": "provider",

  // 5 · document — generate a real document from the profile
  "privacy-policy": "document",
  "accessibility-statement": "document",
  "client-agreement": "document",
  "employment-terms-notice": "document",
  "website-terms": "document",
  "ip-usage-agreement": "document",
  "shipping-returns-policy": "document",

  // 6 · presence — set up a digital asset, then verify it
  "buy-domain": "presence",
  "build-website": "presence",
  "business-email": "presence",
  "google-business-profile": "presence",
  "social-profiles": "presence",
  "whatsapp-business": "presence",
  "online-store-setup": "presence",
  "digital-business-card": "presence",
  "basic-branding": "presence",

  // 7 · calculator — an interactive tool / worksheet
  pricing: "calculator",
  "patur-ceiling-watch": "calculator",
  "tax-money-aside": "calculator",
  "cashflow-budget": "calculator",
  "target-audience": "calculator",
  "marketing-plan": "calculator",

  // 8 · routine — set up an ongoing habit (fallback)
  bookkeeping: "routine",
  "sales-process": "routine",
  "docs-backup": "routine",
  "crm-basic": "routine",
  "inventory-basics": "routine",
  "vehicle-expenses": "routine",
  "employee-rights-basics": "routine",
  "travel-reimbursement": "routine",
  "reviews-mechanism": "routine",
  "capital-statement-prep": "routine",
};

export function resolveArchetype(templateId: string): TaskArchetype {
  return ARCHETYPE_BY_ID[templateId] ?? "routine";
}
