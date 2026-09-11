"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, PencilLine, Wallet } from "lucide-react";
import { setMonthlyIncome } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { Card } from "@/components/ui";
import type { IncomeMonth } from "@/lib/finance/income";

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export function IncomeLogger({
  months,
  synced,
}: {
  months: IncomeMonth[];
  /** true when some revenue already comes from a connected invoicing tool */
  synced?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(months.map((m) => [m.key, m.amount ? String(m.amount) : ""]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(key: string) {
    const amount = Number(values[key] || 0);
    setSavingKey(key);
    startTransition(async () => {
      const res = await setMonthlyIncome(key, amount);
      setSavingKey(null);
      if (res.ok) {
        setSavedKey(key);
        toast.success("ההכנסה נשמרה — המספרים והתחזיות מתעדכנים");
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      } else {
        toast.error(res.error ?? "השמירה נכשלה");
      }
    });
  }

  const total = months.reduce((s, m) => s + (Number(values[m.key]) || 0), 0);

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Wallet className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        <h2 className="text-section text-ink">רישום הכנסה חודשית</h2>
      </div>
      <p className="mb-4 text-xs text-ink-muted">
        {synced
          ? "יש לכם נתונים מתוכנת החשבוניות. אפשר להוסיף כאן חודשים ידנית — הכול מסתכם יחד."
          : "רשמו כמה הכנסתם בכל חודש — וקבלו מיד תחזית הפרשה למיסים, מעקב תקרה וגרף מחזור. בלי צורך לחבר תוכנה."}
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {months.map((m) => {
          const dirty = String(Number(values[m.key]) || 0) !== String(m.amount || 0);
          return (
            <div
              key={m.key}
              className="flex items-center gap-2 rounded-xl border border-edge-soft bg-surface px-3 py-2"
            >
              <span className="w-24 shrink-0 text-sm text-ink-soft">{m.label}</span>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">₪</span>
                <input
                  inputMode="numeric"
                  value={values[m.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [m.key]: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  onBlur={() => dirty && save(m.key)}
                  onKeyDown={(e) => e.key === "Enter" && dirty && save(m.key)}
                  placeholder="0"
                  className="tnum w-full rounded-lg border border-edge bg-card py-1.5 ps-6 pe-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
                  aria-label={`הכנסה ${m.label}`}
                />
              </div>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {savingKey === m.key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-ink-faint" aria-hidden />
                ) : savedKey === m.key ? (
                  <Check className="h-4 w-4 text-status-done" aria-hidden />
                ) : dirty ? (
                  <PencilLine className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-edge-soft pt-3 text-sm">
        <span className="text-ink-soft">סה״כ ב-6 החודשים</span>
        <span className="tnum font-bold text-ink">{nis(total)}</span>
      </div>
    </Card>
  );
}
