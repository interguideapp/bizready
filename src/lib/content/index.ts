import type { TaskTemplate } from "@/lib/types";
import { CATEGORIES } from "./categories";
import { LEGAL_TAX_TASKS } from "./tasks-legal-tax";
import { FINANCE_INSURANCE_TASKS } from "./tasks-finance-insurance";
import { DIGITAL_MARKETING_OPS_TASKS } from "./tasks-digital-marketing-ops";

export { CATEGORIES };

export const TASK_TEMPLATES: TaskTemplate[] = [
  ...LEGAL_TAX_TASKS,
  ...FINANCE_INSURANCE_TASKS,
  ...DIGITAL_MARKETING_OPS_TASKS,
];

export const TEMPLATES_BY_ID = new Map(TASK_TEMPLATES.map((t) => [t.id, t]));

export const CATEGORIES_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Options for the "מה כבר יש?" onboarding step — template ids the user can pre-mark as done. */
export const ALREADY_DONE_OPTIONS: { id: string; label: string }[] = [
  { id: "open-vat-file", label: "פתחתי תיק עוסק במע\"מ" },
  { id: "open-income-tax-file", label: "יש לי תיק במס הכנסה" },
  { id: "open-bituach-leumi-file", label: "נרשמתי בביטוח לאומי" },
  { id: "business-bank-account", label: "יש חשבון בנק נפרד לעסק" },
  { id: "invoicing-software", label: "יש לי תוכנת חשבוניות" },
  { id: "choose-accountant", label: "יש לי רו\"ח / יועץ מס" },
  { id: "buy-domain", label: "יש לי דומיין" },
  { id: "build-website", label: "יש לי אתר / דף נחיתה" },
  { id: "google-business-profile", label: "יש לי פרופיל עסק בגוגל" },
  { id: "whatsapp-business", label: "יש לי וואטסאפ עסקי" },
  { id: "basic-branding", label: "יש לי לוגו ומיתוג" },
  { id: "mandatory-pension", label: "אני מפקיד/ה לפנסיה" },
];
