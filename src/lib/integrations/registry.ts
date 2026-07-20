import { greenInvoiceAdapter } from "./greeninvoice";
import { icountAdapter } from "./icount";
import type { IntegrationCategory, ProviderAdapter, PullableField } from "./types";

/**
 * The full provider catalog. Two direct API adapters (invoicing — where the
 * regulatory value lives) + standardized webhook/CSV recipes for everything
 * else. Every webhook provider shares ONE event schema, so adding a provider
 * here is data, not code.
 */

const DOC_FIELDS: PullableField[] = [
  { key: "customer_name", label: "שמות לקוחות", default: true },
  { key: "allocation_number", label: "מספרי הקצאה", default: true },
  { key: "vat_amount", label: "סכומי מע\"מ", default: true },
];
const LEAD_FIELDS: PullableField[] = [
  { key: "source", label: "מקור הליד", default: true },
  { key: "value", label: "שווי משוער", default: true },
];
const ORDER_FIELDS: PullableField[] = [
  { key: "items_count", label: "מספר פריטים", default: true },
];

function webhookProvider(
  id: string,
  label: string,
  category: IntegrationCategory,
  setupGuide: string,
  pullableFields: PullableField[] = []
): ProviderAdapter {
  return {
    id,
    label,
    category,
    mode: "webhook",
    setupGuide,
    authFields: [],
    pullableFields,
  };
}

function csvProvider(
  id: string,
  label: string,
  category: IntegrationCategory,
  setupGuide: string
): ProviderAdapter {
  return {
    id,
    label,
    category,
    mode: "csv",
    setupGuide,
    authFields: [],
    pullableFields: [],
  };
}

const MAKE_ZAPIER_HINT =
  "דרך Make/Zapier: יוצרים תרחיש שמאזין לאירוע במערכת ושולח POST לכתובת ה-Webhook שלכם (למטה) בפורמט האירועים שלנו.";

export const PROVIDERS: ProviderAdapter[] = [
  // ---- invoicing: direct API ----
  greenInvoiceAdapter,
  icountAdapter,

  // ---- invoicing: recipes ----
  webhookProvider(
    "invoicing-webhook",
    "ספק חשבוניות אחר (EZcount, ריווחית...)",
    "invoicing",
    `שולחים אלינו document.created על כל מסמך. ${MAKE_ZAPIER_HINT}`,
    DOC_FIELDS
  ),
  csvProvider(
    "invoicing-csv",
    "ייצוא מסמכים (חשבשבת / דוח רו\"ח)",
    "invoicing",
    "מייצאים דוח מסמכים חודשי (CSV/Excel→CSV) ומעלים כאן. עמודות: תאריך, סוג, סכום, מע\"מ, לקוח, מספר הקצאה."
  ),

  // ---- payments ----
  webhookProvider(
    "payments-webhook",
    "סליקה (Grow, Cardcom, Tranzila, PayPlus, PayPal, Stripe)",
    "payments",
    `מגדירים אצל חברת הסליקה Webhook על עסקה מוצלחת/כושלת שנשלח כ-payment.received. ${MAKE_ZAPIER_HINT}`
  ),
  csvProvider(
    "payments-csv",
    "ייצוא תשלומים (Bit / Paybox לעסקים)",
    "payments",
    "מייצאים את דוח התנועות מהאפליקציה ומעלים כאן. עמודות: תאריך, סכום, סטטוס."
  ),

  // ---- ecommerce ----
  webhookProvider(
    "store-webhook",
    "חנות אונליין (Wix, Shopify, WooCommerce)",
    "ecommerce",
    `Shopify/Woo: מגדירים Webhook על Order created ישירות. Wix: דרך Automations. שולחים order.created. ${MAKE_ZAPIER_HINT}`,
    ORDER_FIELDS
  ),

  // ---- CRM & leads ----
  webhookProvider(
    "crm-webhook",
    "CRM ולידים (Fireberry, monday, HubSpot, Lead Ads, Sheets)",
    "crm",
    `על כל ליד/שינוי שלב שולחים lead.created / lead.updated. ${MAKE_ZAPIER_HINT}`,
    LEAD_FIELDS
  ),

  // ---- marketing / reviews ----
  webhookProvider(
    "marketing-webhook",
    "דיוור וביקורות (רב מסר, ActiveTrail, Google ביקורות)",
    "other",
    `נרשם/הוסר מרשימת תפוצה או ביקורת חדשה בגוגל — שולחים lead.created עם source מתאים. ${MAKE_ZAPIER_HINT}`
  ),

  // ---- payroll / attendance (CSV until employees phase) ----
  csvProvider(
    "payroll-csv",
    "שכר ונוכחות (חילן, מלם, שעוני נוכחות)",
    "payroll",
    "מעלים ייצוא חודשי: תאריך, עלות שכר כוללת. מזין את התובנות (עלות מול מחזור)."
  ),

  // ---- finance ----
  csvProvider(
    "bank-csv",
    "תנועות בנק (ייצוא מהחשבון)",
    "accounting",
    "מייצאים תנועות מהאתר של הבנק (CSV) ומעלים. עמודות: תאריך, סכום, תיאור."
  ),
];

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  invoicing: "חשבוניות והנהלת חשבונות",
  payments: "סליקה ותשלומים",
  ecommerce: "חנות אינטרנטית",
  crm: "CRM ולידים",
  payroll: "שכר ונוכחות",
  accounting: "בנק ופיננסים",
  other: "דיוור וביקורות",
};

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "invoicing",
  "payments",
  "ecommerce",
  "crm",
  "other",
  "accounting",
  "payroll",
];
