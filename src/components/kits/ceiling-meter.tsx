"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";

/**
 * Live עוסק-פטור ceiling tracker. The user enters turnover so far this year and
 * how many months it covers; we project the annual pace against the ceiling and
 * flag — clearly — when a switch to עוסק מורשה is coming. A real tool, not a tip.
 * Runs entirely client-side (no persistence, no schema change).
 */
export function CeilingMeter({ ceiling }: { ceiling: number }) {
  const [turnover, setTurnover] = useState<string>("");
  const [months, setMonths] = useState<number>(new Date().getMonth() + 1);

  const t = Number(turnover) || 0;
  const usedPct = Math.min(999, Math.round((t / ceiling) * 100));
  const projected = useMemo(() => {
    if (t <= 0 || months <= 0) return 0;
    return Math.round((t / months) * 12);
  }, [t, months]);
  const projectedPct = Math.round((projected / ceiling) * 100);

  const state: "safe" | "warn" | "over" =
    usedPct >= 100 ? "over" : projectedPct >= 85 || usedPct >= 85 ? "warn" : "safe";

  const barColor =
    state === "over"
      ? "bg-status-overdue"
      : state === "warn"
        ? "bg-status-progress"
        : "bg-status-done";

  const nis = (n: number) => "₪" + n.toLocaleString("he-IL");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft">
            מחזור מצטבר השנה (₪)
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={turnover}
            onChange={(e) => setTurnover(e.target.value)}
            placeholder="למשל 45000"
            className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft">
            כמה חודשים זה מכסה?
          </span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* gauge */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
          <span>{nis(t)}</span>
          <span>תקרה {nis(ceiling)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, usedPct)}%` }}
          />
        </div>
        <p className="mt-1 text-xs font-medium text-ink-soft">
          {usedPct}% מהתקרה נוצלו
        </p>
      </div>

      {/* projection */}
      {t > 0 && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
            state === "over"
              ? "border-status-overdue/30 bg-status-overdue-bg/50 text-status-overdue"
              : state === "warn"
                ? "border-status-progress/30 bg-status-progress-bg/50 text-status-progress"
                : "border-status-done/30 bg-status-done-bg/50 text-status-done"
          }`}
        >
          {state === "safe" ? (
            <TrendingUp className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
          )}
          <div className="text-ink-soft">
            <p className="font-semibold text-ink">
              קצב שנתי צפוי: {nis(projected)} ({projectedPct}% מהתקרה)
            </p>
            <p className="mt-0.5 leading-relaxed">
              {state === "over"
                ? "עברתם את התקרה. חובה לעבור לעוסק מורשה — ולשלם מע\"מ על החלק שמעל. דברו עם רו\"ח בהקדם."
                : state === "warn"
                  ? "אתם מתקרבים לתקרה. זה הזמן להתחיל לתכנן מעבר לעוסק מורשה, בלי לחץ של רגע אחרון."
                  : "אתם בטווח בטוח. המשיכו לעדכן את המספר אחת לחודש כדי לא להיתפס לא מוכנים."}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        התקרה מתעדכנת בכל ינואר. הערכה בלבד — המחזור הקובע הוא לפי הספרים.
      </p>
    </div>
  );
}
