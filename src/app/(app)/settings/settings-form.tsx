"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, LogOut, Plus, Minus, RotateCcw, Sparkles } from "lucide-react";
import { previewReconcile, signOut, updateAnswers } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { Card } from "@/components/ui";
import { CATEGORIES_BY_ID } from "@/lib/content";
import type { ReconcileSummary } from "@/lib/rules-engine";
import type { OnboardingAnswers } from "@/lib/types";

const catTitle = (id: string) => CATEGORIES_BY_ID.get(id)?.title ?? "";

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
  { key: "wants_marketing", label: "עזרה בשיווק והבאת לקוחות" },
];

export function SettingsForm({ answers }: { answers: OnboardingAnswers }) {
  // existing users predate wants_marketing — default to true so their marketing
  // tasks don't silently disappear on the next reconcile.
  const [values, setValues] = useState<OnboardingAnswers>({
    ...answers,
    wants_marketing: answers.wants_marketing ?? true,
  });
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  // Tie each dry-run to the exact answers it was computed for, so a preview
  // only shows once it matches the current edits (no stale flashing).
  const [preview, setPreview] = useState<{ sig: string; summary: ReconcileSummary } | null>(null);
  const valuesSig = JSON.stringify(values);
  const dirty = valuesSig !== JSON.stringify(answers);
  const freshPreview = preview && preview.sig === valuesSig ? preview.summary : null;
  const previewing = dirty && !freshPreview;

  // Live dry-run: whenever the edited answers settle, ask the server what the
  // recalibration would do — so the diff is visible before anything is written.
  useEffect(() => {
    if (!dirty) return;
    const sig = valuesSig;
    const timer = setTimeout(async () => {
      const summary = await previewReconcile(JSON.parse(sig) as OnboardingAnswers);
      setPreview({ sig, summary });
    }, 350);
    return () => clearTimeout(timer);
  }, [valuesSig, dirty]);

  function save() {
    startTransition(async () => {
      const summary = await updateAnswers(values);
      setSaved(true);
      const added = summary.added.length;
      const hidden = summary.removed.length;
      const parts = [
        added > 0 ? `${added} משימות נוספו` : "",
        hidden > 0 ? `${hidden} הוסתרו` : "",
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `התכנית כוילה — ${parts.join(" · ")}`
          : "התכנית עודכנה לפי התשובות החדשות"
      );
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

        {dirty && (
          <ChangePreview summary={freshPreview} loading={previewing} />
        )}

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
            {pending ? "מכייל את התכנית..." : saved ? "עודכן!" : "החלת השינויים על התכנית"}
          </button>
          {dirty && !pending && (
            <span className="text-xs text-ink-faint">
              ההיסטוריה נשמרת — כלום לא נמחק
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

/** The live "here's what will change" diff for a pending recalibration. */
function ChangePreview({
  summary,
  loading,
}: {
  summary: ReconcileSummary | null;
  loading: boolean;
}) {
  const groups = [
    {
      key: "added",
      items: summary?.added ?? [],
      label: "משימות חדשות שיתווספו",
      Icon: Plus,
      tone: "text-emerald-600 dark:text-emerald-400",
      ring: "border-emerald-500/30 bg-emerald-500/5",
    },
    {
      key: "removed",
      items: summary?.removed ?? [],
      label: "משימות שכבר לא רלוונטיות — יוסתרו",
      Icon: Minus,
      tone: "text-ink-faint",
      ring: "border-edge bg-surface",
    },
    {
      key: "restored",
      items: summary?.restored ?? [],
      label: "משימות שחוזרות להיות רלוונטיות",
      Icon: RotateCcw,
      tone: "text-brand-600 dark:text-brand-400",
      ring: "border-brand-500/30 bg-brand-500/5",
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mt-5 rounded-2xl border border-edge bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" aria-hidden />
        <span className="text-sm font-semibold text-ink">
          כך תשתנה התכנית שלכם
        </span>
        {loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-faint" aria-hidden />
        )}
      </div>

      {summary && !summary.changed && !loading && (
        <p className="text-sm text-ink-faint">
          השינוי הזה לא מוסיף או מסיר משימות — רק מעדכן את פרטי העסק.
        </p>
      )}

      {!summary && loading && (
        <p className="text-sm text-ink-faint">בודק מה ישתנה…</p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map(({ key, items, label, Icon, tone, ring }) => (
          <div key={key} className={`rounded-xl border ${ring} p-3`}>
            <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label} · {items.length}
            </div>
            <ul className="flex flex-col gap-1.5">
              {items.map((c) => (
                <li key={c.templateId} className="flex items-baseline gap-2 text-sm">
                  <span className="text-ink">{c.title}</span>
                  <span className="text-[11px] text-ink-faint">{catTitle(c.categoryId)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
