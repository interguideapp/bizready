"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";

/**
 * A real pricing tool: from monthly costs, the take-home you want, billable
 * hours and a tax buffer, it works back to the hourly rate you must charge.
 * Client-side only — a calculator, not stored data. Turns a generic "set your
 * price" task into something that actually does the math.
 */
export function PricingCalculator() {
  const [costs, setCosts] = useState("");
  const [salary, setSalary] = useState("");
  const [hours, setHours] = useState("");
  const [taxPct, setTaxPct] = useState("25");

  const c = Number(costs) || 0;
  const s = Number(salary) || 0;
  const h = Number(hours) || 0;
  const tax = Math.min(60, Math.max(0, Number(taxPct) || 0));

  // gross needed = (costs + desired take-home) grossed up for tax; then / hours
  const grossMonthly = h > 0 ? (c + s) / (1 - tax / 100) : 0;
  const perHour = h > 0 ? Math.ceil(grossMonthly / h / 5) * 5 : 0;

  const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

  const fields: { label: string; value: string; set: (v: string) => void; ph: string; suffix?: string }[] = [
    { label: "הוצאות עסקיות בחודש (₪)", value: costs, set: setCosts, ph: "למשל 3000" },
    { label: 'שכר נטו שתרצו למשוך (₪)', value: salary, set: setSalary, ph: "למשל 12000" },
    { label: "שעות עבודה נטו בחודש", value: hours, set: setHours, ph: "למשל 120" },
    { label: "אחוז מס/הפרשות משוער", value: taxPct, set: setTaxPct, ph: "25", suffix: "%" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className="mb-1 block text-sm font-medium text-ink-soft">
              {f.label}
            </span>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
              />
              {f.suffix && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                  {f.suffix}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-brand-edge bg-brand-tint/50 p-4">
        <Calculator className="h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
        {perHour > 0 ? (
          <div>
            <p className="text-sm text-ink-soft">
              כדי לכסות הכל, המחיר לשעה צריך להיות לפחות
            </p>
            <p className="text-2xl font-bold text-ink">{nis(perHour)}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              מבוסס על {nis(grossMonthly)} ברוטו נדרש בחודש. עגלו כלפי מעלה — זה רצפה, לא תקרה.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            מלאו את השדות כדי לקבל מחיר מינימלי מומלץ לשעה.
          </p>
        )}
      </div>

      <p className="text-xs text-ink-faint">
        חישוב עזר בלבד. תמחור אמיתי מביא בחשבון גם ערך ללקוח, מחירי שוק ורווחיות רצויה.
      </p>
    </div>
  );
}
