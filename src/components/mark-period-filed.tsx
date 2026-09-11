"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { markPeriodFiled } from "@/lib/actions";

/**
 * Clear one missed reporting period.
 *
 * The board can now name every period that went unfiled. Without this it could
 * only name them: completing the task records the period its stored deadline
 * points at, so once the oldest is cleared the deadline rolls to the next
 * upcoming period and the intermediate misses become unreachable. An alarm with
 * no off switch is worse than no alarm — people stop trusting the surface
 * rather than the item.
 *
 * Deliberately two taps. Claiming a statutory filing was submitted is a
 * statement of fact that goes into the record, and it should not be one
 * mis-tap away on a row in a list.
 */
export function MarkPeriodFiled({
  templateId,
  periodKey,
  periodLabel,
}: {
  templateId: string;
  periodKey: string;
  periodLabel: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await markPeriodFiled(templateId, periodKey);
      } catch {
        setError("לא הצלחנו לעדכן. נסו שוב.");
        setConfirming(false);
      }
    });
  }

  if (error) {
    return (
      <span role="alert" className="text-xs text-status-overdue">
        {error}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition hover:text-brand-strong"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        כבר הגשתי
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-ink-muted">
        {periodLabel ? `לסמן ${periodLabel} כמוגש?` : "לסמן כמוגש?"}
      </span>
      <button
        onClick={confirm}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-status-done px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        כן
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
      >
        ביטול
      </button>
    </span>
  );
}
