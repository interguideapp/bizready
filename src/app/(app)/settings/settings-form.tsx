"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, LogOut } from "lucide-react";
import { signOut, updateAnswers } from "@/lib/actions";
import { Card } from "@/components/ui";
import type { OnboardingAnswers } from "@/lib/types";

const SELECTS: {
  key: keyof OnboardingAnswers;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "entity_type",
    label: "סוג עוסק",
    options: [
      { value: "osek_patur", label: "עוסק פטור" },
      { value: "osek_murshe", label: "עוסק מורשה" },
    ],
  },
  {
    key: "field",
    label: "תחום פעילות",
    options: [
      { value: "beauty_care", label: "טיפולים ויופי" },
      { value: "food", label: "מזון" },
      { value: "consulting", label: "ייעוץ, הדרכה ולימוד" },
      { value: "tech", label: "טכנולוגיה ודיגיטל" },
      { value: "commerce", label: "מסחר ומכירות" },
      { value: "professional", label: "שירותים מקצועיים" },
      { value: "creative", label: "אומנות ויצירה" },
      { value: "construction", label: "בנייה ושיפוצים" },
      { value: "other", label: "אחר" },
    ],
  },
  {
    key: "stage",
    label: "שלב העסק",
    options: [
      { value: "idea", label: "רעיון" },
      { value: "setting_up", label: "בהקמה" },
      { value: "active", label: "פעיל" },
    ],
  },
  {
    key: "expected_revenue",
    label: "צפי הכנסה שנתית",
    options: [
      { value: "under_60k", label: "עד ₪60,000" },
      { value: "60k_to_ceiling", label: "עד תקרת עוסק פטור" },
      { value: "over_ceiling", label: "מעל התקרה" },
    ],
  },
  {
    key: "work_location",
    label: "מיקום הפעילות",
    options: [
      { value: "home", label: "מהבית" },
      { value: "premises", label: "חנות / סטודיו / משרד" },
      { value: "mobile", label: "נייד" },
      { value: "online_only", label: "אונליין בלבד" },
    ],
  },
  {
    key: "sales_channel",
    label: "ערוץ מכירה",
    options: [
      { value: "in_person", label: "פרונטלי" },
      { value: "online", label: "אונליין" },
      { value: "both", label: "גם וגם" },
    ],
  },
  {
    key: "client_type",
    label: "סוג הלקוחות",
    options: [
      { value: "private", label: "פרטיים" },
      { value: "business", label: "עסקים" },
      { value: "both", label: "גם וגם" },
    ],
  },
  {
    key: "product_type",
    label: "מה מוכרים",
    options: [
      { value: "services", label: "שירותים" },
      { value: "physical_products", label: "מוצרים פיזיים" },
      { value: "digital_products", label: "מוצרים דיגיטליים" },
      { value: "mixed", label: "גם וגם" },
    ],
  },
];

/** Shown only when the business plans to hire. */
const EMPLOYEE_SELECT = {
  key: "employee_work_mode" as const,
  label: "איפה העובדים עובדים",
  options: [
    { value: "on_site", label: "במקום העבודה" },
    { value: "remote", label: "מהבית / מרחוק" },
    { value: "field", label: "בשטח / אצל לקוחות" },
    { value: "mixed", label: "משולב" },
  ],
};

/** Shown only for עוסק מורשה — drives the real VAT/advances filing dates. */
const VAT_FREQUENCY_SELECT = {
  key: "vat_frequency" as const,
  label: "תדירות דיווח מע\"מ ומקדמות",
  options: [
    { value: "bimonthly", label: "אחת לחודשיים" },
    { value: "monthly", label: "כל חודש" },
  ],
};

const TOGGLES: { key: keyof OnboardingAnswers; label: string }[] = [
  { key: "hosts_clients", label: "מקבל/ת לקוחות פיזית" },
  { key: "collects_personal_data", label: "שומר/ת פרטים אישיים של לקוחות" },
  { key: "uses_vehicle", label: "משתמש/ת ברכב לעסק" },
  { key: "has_website", label: "יש אתר אינטרנט" },
  { key: "plans_employees", label: "מתכנן/ת להעסיק עובדים" },
];

export function SettingsForm({ answers }: { answers: OnboardingAnswers }) {
  const [values, setValues] = useState<OnboardingAnswers>(answers);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(answers);

  function save() {
    startTransition(async () => {
      await updateAnswers(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="mb-4 font-bold text-ink">פרופיל העסק</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ...SELECTS,
            ...(values.entity_type === "osek_murshe"
              ? [VAT_FREQUENCY_SELECT]
              : []),
            ...(values.plans_employees ? [EMPLOYEE_SELECT] : []),
          ].map(({ key, label, options }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-sm font-medium text-ink-soft">
                {label}
              </span>
              <select
                value={
                  (values[key] as string | undefined) ??
                  (key === "vat_frequency" ? "bimonthly" : "")
                }
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: e.target.value }))
                }
                className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {TOGGLES.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-edge-soft px-4 py-3"
            >
              <span className="text-sm font-medium text-ink-soft">{label}</span>
              <input
                type="checkbox"
                checked={values[key] as boolean}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: e.target.checked }))
                }
                className="h-5 w-5 accent-brand-600"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              saved && <Check className="h-4 w-4" aria-hidden />
            )}
            {pending ? "מעדכן את התכנית..." : saved ? "עודכן!" : "שמירה ועדכון התכנית"}
          </button>
          {dirty && !pending && (
            <span className="text-xs text-ink-faint">
              משימות חדשות יתווספו, לא-רלוונטיות יוסתרו — ההיסטוריה נשמרת
            </span>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold text-ink">חשבון</h2>
        <button
          onClick={() => startTransition(() => signOut())}
          className="inline-flex items-center gap-2 rounded-xl border border-edge px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:border-status-overdue hover:text-status-overdue"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          התנתקות
        </button>
      </Card>
    </div>
  );
}
