import type { EntityType, TaskTemplate } from "@/lib/types";
import { CATEGORIES } from "./categories";
import { LEGAL_TAX_TASKS } from "./tasks-legal-tax";
import { FINANCE_INSURANCE_TASKS } from "./tasks-finance-insurance";
import { DIGITAL_MARKETING_OPS_TASKS } from "./tasks-digital-marketing-ops";
import { EMPLOYMENT_TASKS } from "./tasks-employment";
import { SPECIFIC_TASKS } from "./tasks-specific";
import { ENTITY_TASKS } from "./tasks-entities";

export { CATEGORIES };

export const TASK_TEMPLATES: TaskTemplate[] = [
  ...LEGAL_TAX_TASKS,
  ...ENTITY_TASKS,
  ...FINANCE_INSURANCE_TASKS,
  ...DIGITAL_MARKETING_OPS_TASKS,
  ...SPECIFIC_TASKS,
  ...EMPLOYMENT_TASKS,
];

export const TEMPLATES_BY_ID = new Map(TASK_TEMPLATES.map((t) => [t.id, t]));

export const CATEGORIES_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/**
 * Options for the "מה כבר יש?" onboarding step — template ids the user can
 * pre-mark as done. `entities`, when present, limits an option to those legal
 * structures (so a company isn't offered the individual עוסק registration);
 * options without it show for everyone.
 */
export const ALREADY_DONE_OPTIONS: {
  id: string;
  label: string;
  entities?: EntityType[];
}[] = [
  // individual / partnership registration
  { id: "open-vat-file", label: "פתחתי תיק עוסק במע\"מ", entities: ["osek_patur", "osek_murshe", "partnership"] },
  { id: "open-income-tax-file", label: "יש לי תיק במס הכנסה", entities: ["osek_patur", "osek_murshe", "partnership"] },
  { id: "open-bituach-leumi-file", label: "נרשמתי בביטוח לאומי", entities: ["osek_patur", "osek_murshe", "partnership"] },
  // company
  { id: "register-company", label: "רשמתי חברה ברשם החברות", entities: ["company"] },
  { id: "company-tax-files", label: "פתחתי לחברה תיקי מס", entities: ["company"] },
  { id: "company-bank-account", label: "יש חשבון בנק על שם החברה", entities: ["company"] },
  // partnership
  { id: "register-partnership", label: "רשמתי שותפות ברשם השותפויות", entities: ["partnership"] },
  { id: "partnership-agreement", label: "יש הסכם שותפות חתום", entities: ["partnership"] },
  // universal
  { id: "business-bank-account", label: "יש חשבון בנק נפרד לעסק", entities: ["osek_patur", "osek_murshe", "partnership"] },
  { id: "invoicing-software", label: "יש לי תוכנת חשבוניות" },
  { id: "choose-accountant", label: "יש לי רו\"ח / יועץ מס" },
  { id: "buy-domain", label: "יש לי דומיין" },
  { id: "build-website", label: "יש לי אתר / דף נחיתה" },
  { id: "google-business-profile", label: "יש לי פרופיל עסק בגוגל" },
  { id: "whatsapp-business", label: "יש לי וואטסאפ עסקי" },
  { id: "basic-branding", label: "יש לי לוגו ומיתוג" },
  { id: "mandatory-pension", label: "אני מפקיד/ה לפנסיה", entities: ["osek_patur", "osek_murshe", "partnership"] },
];
