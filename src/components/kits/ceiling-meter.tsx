"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatIls as nis, parseIls } from "@/lib/money";

/**
 * Live עוסק-פטור ceiling tracker. The user enters turnover so far this year and
 * how many months it covers; we project the annual pace against the ceiling and
 * flag — clearly — when a switch to עוסק מורשה is coming. A real tool, not a tip.
 * Runs entirely client-side (no persistence, no schema change).
 */
export function CeilingMeter({ ceiling }: { ceiling: number }) {
  const [turnover, setTurnover] = useState<string>("");
  const [months, setMonths] = useState<number>(new Date().getMonth() + 1);

  /*
   * parseIls, NOT Number() -- and this is the field where it matters most.
   *
   * Number("122,000") is NaN, and "|| 0" turned that into ZERO. So a user who
   * typed their turnover the way Hebrew writes it, with a thousands separator
   * -- the way this very component RENDERS money two lines below, via
   * formatIls -- saw the meter read 0%, green, "safe", while standing ₪833
   * from the ceiling.
   *
   * That is the dangerous direction, and this codebase says so elsewhere in
   * as many words: understating the ceiling tells someone they have room when
   * they have crossed the line. parseIls exists for exactly this and was
   * called by nothing.
   *
   * The empty field and an unparseable one are kept apart. Empty is the
   * starting state and means nothing yet; unparseable means the person typed
   * something and we could not read it, which has to be said rather than
   * shown as zero.
   */
  const parsed = parseIls(turnover);
  const unreadable = turnover.trim() !== "" && parsed === null;
  const t = parsed ?? 0;
  // The true percentage, uncapped. The old Math.min(999, …) was a clamp
  // showing through to the user, and it sat beside a bar capped at 100% — so
  // the label and the bar told different stories about the same number.
  const usedPct = ceiling > 0 ? Math.round((t / ceiling) * 100) : 0;
  // What the bar can actually draw. Kept separate from the label on purpose:
  // the bar is full at 100% and the overage is stated in words instead of
  // being implied by a bar that cannot grow.
  const barPct = Math.min(100, usedPct);
  const overBy = Math.max(0, t - ceiling);
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



  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft">
            מחזור מצטבר השנה (₪)
          </span>
          {/* TEXT, not number.
              type="number" makes the browser itself blank a value containing a
              thousands separator, so "122,000" arrived here as "" and the
              meter read 0% — the same wrong answer parseIls was added to
              prevent, reached by a different route. A field that silently
              discards what a person typed is worse than one that reads it and
              says it cannot. */}
          <input
            type="text"
            inputMode="decimal"
            value={turnover}
            onChange={(e) => setTurnover(e.target.value)}
            placeholder="למשל 45,000"
            aria-invalid={unreadable || undefined}
            aria-describedby={unreadable ? "ceiling-turnover-error" : undefined}
            className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
          {unreadable && (
            <p
              id="ceiling-turnover-error"
              className="mt-1 text-xs text-status-overdue"
            >
              לא הצלחנו לקרוא את הסכום. אפשר לכתוב 45000 או 45,000 — עם ₪ או בלי.
            </p>
          )}
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
        <div
          className="h-3 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={barPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="ניצול תקרת עוסק פטור"
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs font-medium text-ink-soft">
          {usedPct}% מהתקרה נוצלו
          {/* Said in words rather than left to a bar that cannot grow past
              full. The label used to be clamped at 999% beside a bar clamped
              at 100%, so the two contradicted each other. */}
          {overBy > 0 && (
            <span className="text-status-overdue"> — חריגה של {nis(overBy)}</span>
          )}
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
                ? "עברתם את התקרה. חובה לעבור לעוסק מורשה — ולשלם מע״מ על החלק שמעל. דברו עם רו״ח בהקדם."
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
