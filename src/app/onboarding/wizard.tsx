"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { completeOnboarding } from "@/lib/actions";
import { ALREADY_DONE_OPTIONS } from "@/lib/content";
import type { OnboardingAnswers } from "@/lib/types";
import { YEARLY_FIGURES } from "@/lib/types";

type Draft = Partial<OnboardingAnswers> & { businessName?: string };

const FIELD_OPTIONS: { value: OnboardingAnswers["field"]; label: string }[] = [
  { value: "beauty_care", label: "טיפולים ויופי" },
  { value: "food", label: "מזון" },
  { value: "consulting", label: "ייעוץ, הדרכה ולימוד" },
  { value: "tech", label: "טכנולוגיה ודיגיטל" },
  { value: "commerce", label: "מסחר ומכירות" },
  { value: "professional", label: "שירותים מקצועיים" },
  { value: "creative", label: "אומנות ויצירה" },
  { value: "construction", label: "בנייה ושיפוצים" },
  { value: "other", label: "אחר" },
];

interface Step {
  id: string;
  title: string;
  subtitle?: string;
  isValid: (d: Draft) => boolean;
}

const STEPS: Step[] = [
  { id: "name", title: "איך קוראים לעסק?", subtitle: "אפשר גם שם זמני — תמיד ניתן לשנות", isValid: (d) => !!d.businessName?.trim() },
  { id: "stage", title: "באיזה שלב אתם?", isValid: (d) => !!d.stage },
  { id: "entity", title: "איזה סוג עוסק?", subtitle: "לא בטוחים? נעזור להחליט", isValid: (d) => !!d.entity_type },
  { id: "field", title: "מה תחום הפעילות?", isValid: (d) => !!d.field },
  { id: "revenue", title: "כמה העסק צפוי להכניס בשנה?", subtitle: "הערכה גסה — משפיע על מיסוי והמלצות", isValid: (d) => !!d.expected_revenue },
  { id: "location", title: "מאיפה העסק פועל?", isValid: (d) => !!d.work_location },
  { id: "channels", title: "איך אתם מוכרים ולמי?", isValid: (d) => !!d.sales_channel && !!d.client_type },
  { id: "product", title: "מה אתם מוכרים?", subtitle: "קובע אם צריך חנות, משלוחים או ניהול מלאי", isValid: (d) => !!d.product_type },
  { id: "details", title: "עוד כמה שאלות קצרות", subtitle: "כן/לא — כל תשובה מדייקת את התכנית", isValid: (d) => d.hosts_clients !== undefined && d.collects_personal_data !== undefined && d.uses_vehicle !== undefined && d.has_website !== undefined && d.plans_employees !== undefined },
  { id: "employees", title: "איפה העובדים יעבדו?", subtitle: "רלוונטי לרישום נוכחות ולתנאי העסקה", isValid: (d) => !d.plans_employees || !!d.employee_work_mode },
  { id: "already", title: "מה כבר סידרתם?", subtitle: "נסמן כהושלם — הציון שלכם יתחיל מהמקום האמיתי", isValid: () => true },
];

export function OnboardingWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({ already_done: [] });
  const [entityHelp, setEntityHelp] = useState(false);
  const [pending, startTransition] = useTransition();

  const step = STEPS[stepIndex];
  const progress = Math.round((stepIndex / STEPS.length) * 100);
  const canNext = useMemo(() => step.isValid(draft), [step, draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  /** The employees step is only shown when the user plans to hire. */
  const isVisible = (i: number) =>
    STEPS[i].id !== "employees" || !!draft.plans_employees;

  function next() {
    let i = stepIndex + 1;
    while (i < STEPS.length && !isVisible(i)) i++;
    if (i < STEPS.length) setStepIndex(i);
    else submit();
  }

  function back() {
    let i = stepIndex - 1;
    while (i > 0 && !isVisible(i)) i--;
    setStepIndex(Math.max(0, i));
  }

  function submit() {
    const answers: OnboardingAnswers = {
      stage: draft.stage!,
      entity_type: draft.entity_type!,
      field: draft.field!,
      expected_revenue: draft.expected_revenue!,
      work_location: draft.work_location!,
      sales_channel: draft.sales_channel!,
      client_type: draft.client_type!,
      product_type: draft.product_type!,
      hosts_clients: draft.hosts_clients!,
      collects_personal_data: draft.collects_personal_data!,
      uses_vehicle: draft.uses_vehicle!,
      has_website: draft.has_website!,
      plans_employees: draft.plans_employees!,
      employee_work_mode: draft.plans_employees
        ? draft.employee_work_mode ?? "on_site"
        : "on_site",
      already_done: draft.already_done ?? [],
    };
    startTransition(() => completeOnboarding(draft.businessName!.trim(), answers));
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* progress */}
      <div className="sticky top-0 z-10 bg-surface/95 px-6 pt-6 pb-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-brand-strong">BizReady</span>
            <span>
              שאלה {stepIndex + 1} מתוך {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-6">
        <div key={step.id} className="animate-fade-up flex-1">
          <h1 className="text-2xl font-bold text-ink">{step.title}</h1>
          {step.subtitle && (
            <p className="mt-1 text-ink-muted">{step.subtitle}</p>
          )}

          <div className="mt-6">
            {step.id === "name" && (
              <input
                autoFocus
                value={draft.businessName ?? ""}
                onChange={(e) => set("businessName", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canNext && next()}
                placeholder="למשל: הסטודיו של דנה"
                className="w-full rounded-2xl border border-edge-strong bg-card px-5 py-4 text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
              />
            )}

            {step.id === "stage" && (
              <ChoiceList
                value={draft.stage}
                onChange={(v) => set("stage", v)}
                options={[
                  { value: "idea", label: "יש רעיון, עוד לא התחלתי", hint: "נבנה תכנית הקמה מסודרת מאפס" },
                  { value: "setting_up", label: "בתהליך הקמה", hint: "נוודא שלא מפספסים אף שלב" },
                  { value: "active", label: "העסק כבר פעיל", hint: "נבדוק מה חסר ונשלים פערים" },
                ]}
              />
            )}

            {step.id === "entity" && (
              <div className="flex flex-col gap-3">
                <ChoiceList
                  value={draft.entity_type}
                  onChange={(v) => {
                    set("entity_type", v);
                    setEntityHelp(false);
                  }}
                  options={[
                    { value: "osek_patur", label: "עוסק פטור", hint: `מחזור עד ₪${YEARLY_FIGURES.osekPaturCeiling.toLocaleString()} בשנה, בלי גביית מע"מ` },
                    { value: "osek_murshe", label: "עוסק מורשה", hint: "כל מחזור, גובים ומקזזים מע\"מ" },
                  ]}
                />
                <button
                  onClick={() => setEntityHelp((v) => !v)}
                  className="text-right text-sm font-medium text-brand-strong hover:text-brand-strong"
                >
                  לא בטוחים מה מתאים? ככה מחליטים ←
                </button>
                {entityHelp && (
                  <div className="animate-fade-up rounded-2xl border border-brand-edge bg-brand-tint/60 p-4 text-sm leading-relaxed text-ink-soft">
                    <p className="font-semibold text-ink">כלל אצבע:</p>
                    <ul className="mt-2 list-disc space-y-1.5 pr-5">
                      <li>
                        צפי מחזור מתחת ל-₪
                        {YEARLY_FIGURES.osekPaturCeiling.toLocaleString()} בשנה
                        ולקוחות בעיקר פרטיים — <b>עוסק פטור</b>: פחות בירוקרטיה,
                        בלי דיווחי מע"מ
                      </li>
                      <li>
                        מחזור גבוה יותר, או לקוחות עסקיים שרוצים לקזז מע"מ, או
                        הוצאות הקמה גדולות שכדאי לקזז — <b>עוסק מורשה</b>
                      </li>
                      <li>אפשר להתחיל פטור ולעבור למורשה כשגדלים</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {step.id === "field" && (
              <div className="grid grid-cols-2 gap-2.5">
                {FIELD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => set("field", opt.value)}
                    className={`rounded-2xl border px-4 py-3.5 text-sm font-medium transition ${
                      draft.field === opt.value
                        ? "border-brand-600 bg-brand-tint text-brand-strong ring-2 ring-brand-edge"
                        : "border-edge bg-card text-ink-soft hover:border-edge-strong"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {step.id === "revenue" && (
              <ChoiceList
                value={draft.expected_revenue}
                onChange={(v) => set("expected_revenue", v)}
                options={[
                  { value: "under_60k", label: "עד ₪60,000", hint: "עסק צדדי או התחלה רגועה" },
                  { value: "60k_to_ceiling", label: `₪60,000 – ₪${YEARLY_FIGURES.osekPaturCeiling.toLocaleString()}`, hint: "בתוך תקרת עוסק פטור" },
                  { value: "over_ceiling", label: `מעל ₪${YEARLY_FIGURES.osekPaturCeiling.toLocaleString()}`, hint: "מעל התקרה — עוסק מורשה" },
                ]}
              />
            )}

            {step.id === "location" && (
              <ChoiceList
                value={draft.work_location}
                onChange={(v) => set("work_location", v)}
                options={[
                  { value: "home", label: "מהבית" },
                  { value: "premises", label: "חנות / סטודיו / משרד" },
                  { value: "mobile", label: "נייד — מגיע ללקוחות" },
                  { value: "online_only", label: "אונליין בלבד" },
                ]}
              />
            )}

            {step.id === "channels" && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-2.5 text-sm font-semibold text-ink-soft">איך מוכרים?</p>
                  <ChoiceList
                    value={draft.sales_channel}
                    onChange={(v) => set("sales_channel", v)}
                    options={[
                      { value: "in_person", label: "פנים מול פנים" },
                      { value: "online", label: "אונליין" },
                      { value: "both", label: "גם וגם" },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-2.5 text-sm font-semibold text-ink-soft">מי הלקוחות?</p>
                  <ChoiceList
                    value={draft.client_type}
                    onChange={(v) => set("client_type", v)}
                    options={[
                      { value: "private", label: "אנשים פרטיים" },
                      { value: "business", label: "עסקים" },
                      { value: "both", label: "גם וגם" },
                    ]}
                  />
                </div>
              </div>
            )}

            {step.id === "product" && (
              <ChoiceList
                value={draft.product_type}
                onChange={(v) => set("product_type", v)}
                options={[
                  { value: "services", label: "שירותים", hint: "ייעוץ, טיפולים, עבודה מקצועית" },
                  { value: "physical_products", label: "מוצרים פיזיים", hint: "צריך משלוחים ומלאי" },
                  { value: "digital_products", label: "מוצרים דיגיטליים", hint: "קבצים, קורסים, מנויים" },
                  { value: "mixed", label: "גם וגם", hint: "שירותים ומוצרים" },
                ]}
              />
            )}

            {step.id === "employees" && (
              <ChoiceList
                value={draft.employee_work_mode}
                onChange={(v) => set("employee_work_mode", v)}
                options={[
                  { value: "on_site", label: "במקום העבודה", hint: "שעון נוכחות פיזי / טאבלט" },
                  { value: "remote", label: "מהבית / מרחוק", hint: "אפליקציית נוכחות" },
                  { value: "field", label: "בשטח / אצל לקוחות", hint: "דיווח נייד עם מיקום" },
                  { value: "mixed", label: "משולב", hint: "חלק במקום, חלק מרחוק" },
                ]}
              />
            )}

            {step.id === "details" && (
              <div className="flex flex-col gap-3">
                <YesNo label="מקבלים לקוחות פיזית? (גם בבית)" value={draft.hosts_clients} onChange={(v) => set("hosts_clients", v)} />
                <YesNo label="שומרים פרטים של לקוחות? (טלפונים, מיילים)" value={draft.collects_personal_data} onChange={(v) => set("collects_personal_data", v)} />
                <YesNo label="משתמשים ברכב לצורכי העסק?" value={draft.uses_vehicle} onChange={(v) => set("uses_vehicle", v)} />
                <YesNo label="יש כבר אתר אינטרנט לעסק?" value={draft.has_website} onChange={(v) => set("has_website", v)} />
                <YesNo label="מתכננים להעסיק עובדים בשנה הקרובה?" value={draft.plans_employees} onChange={(v) => set("plans_employees", v)} />
              </div>
            )}

            {step.id === "already" && (
              <div className="flex flex-col gap-2">
                {ALREADY_DONE_OPTIONS.map((opt) => {
                  const selected = draft.already_done?.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        set(
                          "already_done",
                          selected
                            ? draft.already_done!.filter((id) => id !== opt.id)
                            : [...(draft.already_done ?? []), opt.id]
                        )
                      }
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-right text-sm font-medium transition ${
                        selected
                          ? "border-brand-600 bg-brand-tint text-brand-strong"
                          : "border-edge bg-card text-ink-soft hover:border-edge-strong"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          selected
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-edge-strong bg-card"
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
                <p className="mt-1 text-xs text-ink-faint">
                  שום דבר? לגמרי בסדר — בשביל זה אנחנו כאן.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* nav buttons */}
        <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-3 border-t border-edge bg-surface/95 px-6 py-4 backdrop-blur">
          {stepIndex > 0 && (
            <button
              onClick={back}
              className="inline-flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              חזרה
            </button>
          )}
          <button
            onClick={next}
            disabled={!canNext || pending}
            className="mr-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                בונים את התכנית...
              </>
            ) : stepIndex === STEPS.length - 1 ? (
              "בנו לי את התכנית"
            ) : (
              <>
                המשך
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceList<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-2xl border px-5 py-4 text-right transition ${
            value === opt.value
              ? "border-brand-600 bg-brand-tint ring-2 ring-brand-edge"
              : "border-edge bg-card hover:border-edge-strong"
          }`}
        >
          <span
            className={`block font-semibold ${
              value === opt.value ? "text-brand-strong" : "text-ink"
            }`}
          >
            {opt.label}
          </span>
          {opt.hint && (
            <span className="mt-0.5 block text-sm text-ink-muted">{opt.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-edge bg-card px-4 py-3.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex shrink-0 gap-1.5">
        {[
          { v: true, label: "כן" },
          { v: false, label: "לא" },
        ].map(({ v, label: l }) => (
          <button
            key={l}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              value === v
                ? "bg-brand-600 text-white"
                : "bg-surface-2 text-ink-soft hover:bg-surface-3"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
