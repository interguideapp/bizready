// Shared domain types for BizReady

export type EntityType = "osek_patur" | "osek_murshe";

export type BusinessStage = "idea" | "setting_up" | "active";

export type ActivityField =
  | "beauty_care" // טיפולים ויופי
  | "food" // מזון
  | "consulting" // ייעוץ והדרכה
  | "tech" // טכנולוגיה ודיגיטל
  | "commerce" // מסחר
  | "professional" // שירותים מקצועיים
  | "creative" // אומנות ויצירה
  | "construction" // בנייה ושיפוצים
  | "other";

export type WorkLocation = "home" | "premises" | "mobile" | "online_only";
export type SalesChannel = "in_person" | "online" | "both";
export type ClientType = "private" | "business" | "both";
/** What the business sells — drives store, shipping, inventory. */
export type ProductType =
  | "services"
  | "physical_products"
  | "digital_products"
  | "mixed";
/** Where employees work — drives the attendance-tracking variant. */
export type EmployeeWorkMode = "on_site" | "remote" | "field" | "mixed";

/** Answers collected by the onboarding wizard. */
export interface OnboardingAnswers {
  stage: BusinessStage;
  entity_type: EntityType;
  field: ActivityField;
  expected_revenue: "under_60k" | "60k_to_ceiling" | "over_ceiling";
  work_location: WorkLocation;
  sales_channel: SalesChannel;
  client_type: ClientType;
  product_type: ProductType;
  hosts_clients: boolean; // מקבל לקוחות פיזית
  collects_personal_data: boolean;
  uses_vehicle: boolean;
  has_website: boolean;
  plans_employees: boolean;
  /** Only meaningful when plans_employees is true. */
  employee_work_mode: EmployeeWorkMode;
  /**
   * VAT / income-tax-advances reporting frequency. Drives the real filing
   * dates in the Compliance Guardian. Only meaningful for osek_murshe;
   * defaults to bimonthly when unset. Set by the tax authority per turnover.
   */
  vat_frequency?: "monthly" | "bimonthly";
  /** Template ids the user marked as already done in "מה כבר יש?" */
  already_done: string[];
}

export type TaskPriority = "critical" | "important" | "recommended";
/** `waiting` = handed off to an authority/third party and we're waiting on them. */
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "waiting"
  | "done"
  | "not_relevant";
export type Recurrence = "monthly" | "bimonthly" | "yearly" | null;

/** Columns on `businesses` that a completion field may populate. */
export type BusinessField =
  | "dealer_number"
  | "vat_file"
  | "income_tax_file"
  | "bituach_leumi_file"
  | "bank_name"
  | "bank_account"
  | "accountant_name"
  | "accountant_phone";

export interface CompletionField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "url" | "date";
  required?: boolean;
  /** When set, the answer is also saved onto the business card. */
  writesTo?: BusinessField;
}

/**
 * What the user must supply to mark a task done — the "indication it was really
 * handled". Every task also requires ticking off its steps; this adds evidence.
 */
export interface CompletionSpec {
  /** Sentence the user confirms, e.g. "פתחתי את התיק וקיבלתי אישור". */
  confirm: string;
  fields?: CompletionField[];
}

export interface OfficialLink {
  label: string;
  url: string;
}

/**
 * A condition evaluated against OnboardingAnswers.
 * Each key must match; array value = "answer is one of",
 * boolean value = exact match. Empty object = applies to everyone.
 */
export type AppliesWhen = Partial<{
  entity_type: EntityType[];
  field: ActivityField[];
  work_location: WorkLocation[];
  sales_channel: SalesChannel[];
  client_type: ClientType[];
  product_type: ProductType[];
  employee_work_mode: EmployeeWorkMode[];
  expected_revenue: ("under_60k" | "60k_to_ceiling" | "over_ceiling")[];
  hosts_clients: boolean;
  collects_personal_data: boolean;
  uses_vehicle: boolean;
  has_website: boolean;
  plans_employees: boolean;
}>;

/**
 * A profile-specific override of the task's steps. The first variant whose
 * `when` matches the answers wins; otherwise the template's default steps show.
 */
export interface TemplateVariant {
  when: AppliesWhen;
  steps: string;
  why?: string;
}

export interface TaskTemplate {
  id: string;
  category_id: string;
  title: string;
  why: string;
  steps: string; // markdown
  /** Profile-specific step overrides (e.g. attendance app vs. physical clock). */
  variants?: TemplateVariant[];
  /** Optional long-form guide (markdown) rendered as an expandable section. */
  guide?: string;
  /** Evidence required to close this task. Falls back to a generic confirmation. */
  completion?: CompletionSpec;
  official_links: OfficialLink[];
  docs_needed: string[];
  est_cost?: string;
  est_time?: string;
  applies_when: AppliesWhen;
  depends_on: string[];
  deadline_days?: number;
  recurrence?: Recurrence;
  priority: TaskPriority;
  source_url?: string;
  last_reviewed: string; // ISO date
  sort_order: number;
}

/** The lifecycle band a category belongs to — turns a flat pile into a journey. */
export type LifeStage = "setup" | "operating" | "growth";

export const LIFE_STAGES: { id: LifeStage; title: string; subtitle: string }[] = [
  { id: "setup", title: "הקמה", subtitle: "הבסיס החוקי — לפתוח נכון" },
  { id: "operating", title: "תפעול שוטף", subtitle: "לעמוד בחובות ולנהל את השוטף" },
  { id: "growth", title: "צמיחה", subtitle: "להביא לקוחות ולגדול" },
];

export interface Category {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  stage: LifeStage;
  sort_order: number;
}

export interface BusinessTask {
  id: string;
  business_id: string;
  template_id: string;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  is_relevant: boolean;
  completion_data?: Record<string, string>;
  follow_up_date?: string | null;
  waiting_for?: string | null;
}

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 3,
  important: 2,
  recommended: 1,
};

/** Fallback evidence prompt for tasks with no bespoke completion spec. */
export const DEFAULT_COMPLETION: CompletionSpec = {
  confirm: "ביצעתי את הצעדים והמשימה מטופלת",
  fields: [
    {
      key: "note",
      label: "מה עשית בפועל? (משפט קצר — יישמר ביומן)",
      placeholder: "למשל: נרשמתי אונליין וקיבלתי אישור במייל",
      required: true,
    },
  ],
};

/** Yearly-updated legal figures, kept in one place (verified 2026-07-18). */
export const YEARLY_FIGURES = {
  year: 2026,
  /** תקרת עוסק פטור */
  osekPaturCeiling: 122_833,
  /** סף חובת מספר הקצאה (חשבוניות ישראל) החל מיוני 2026, לפני מע"מ */
  invoiceAllocationThreshold: 5_000,
  /** שכר ממוצע במשק (לחישובי פנסיה חובה) */
  averageWage: 13_769,
} as const;
