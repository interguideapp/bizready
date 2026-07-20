"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, Loader2, X } from "lucide-react";
import { completeTask } from "@/lib/actions";
import type { CompletionSpec } from "@/lib/types";
import { DEFAULT_COMPLETION } from "@/lib/types";

/**
 * Closing a task is a short, deliberate flow — never a single click:
 * tick off the steps, then give a real indication it was handled.
 */
export function CompleteTaskFlow({
  taskId,
  steps,
  completion,
  onCancel,
}: {
  taskId: string;
  steps: string[];
  completion?: CompletionSpec;
  onCancel: () => void;
}) {
  const spec = completion ?? DEFAULT_COMPLETION;
  const [checked, setChecked] = useState<boolean[]>(() => steps.map(() => false));
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const allStepsDone = checked.every(Boolean);
  const requiredFilled = useMemo(
    () =>
      (spec.fields ?? [])
        .filter((f) => f.required)
        .every((f) => (values[f.key] ?? "").trim().length > 0),
    [spec.fields, values]
  );
  const canSubmit = allStepsDone && confirmed && requiredFilled;

  function submit() {
    if (!canSubmit) return;
    setError("");
    const businessFields: Record<string, string> = {};
    for (const field of spec.fields ?? []) {
      const value = (values[field.key] ?? "").trim();
      if (field.writesTo && value) businessFields[field.writesTo] = value;
    }
    startTransition(async () => {
      try {
        await completeTask(taskId, values, businessFields);
      } catch (e) {
        setError(e instanceof Error ? e.message : "השמירה נכשלה");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-brand-edge bg-card p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">סיום המשימה</h3>
          <p className="text-sm text-ink-muted">
            רגע לפני שסוגרים — נוודא שזה באמת טופל
          </p>
        </div>
        <button
          onClick={onCancel}
          aria-label="ביטול"
          className="rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* 1. tick off the steps */}
      <p className="mb-2 text-sm font-semibold text-ink-soft">
        1. עברת על הצעדים?
      </p>
      <ul className="mb-4 flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <li key={i}>
            <button
              onClick={() =>
                setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))
              }
              className="flex w-full items-start gap-2.5 rounded-xl border border-edge-soft px-3 py-2 text-right text-sm transition hover:border-edge"
            >
              <span
                className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition ${
                  checked[i]
                    ? "border-status-done bg-status-done text-white"
                    : "border-edge-strong bg-card"
                }`}
              >
                {checked[i] && <Check className="h-3 w-3" aria-hidden />}
              </span>
              <span className={checked[i] ? "text-ink-muted line-through" : "text-ink-soft"}>
                {step}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* 2. evidence */}
      {(spec.fields ?? []).length > 0 && (
        <>
          <p className="mb-2 text-sm font-semibold text-ink-soft">
            2. מה מאשר שזה טופל?
          </p>
          <div className="mb-4 flex flex-col gap-2.5">
            {(spec.fields ?? []).map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">
                  {field.label}
                  {field.required && <span className="text-status-overdue"> *</span>}
                  {field.writesTo && (
                    <span className="mr-1 text-ink-faint">· יישמר בכרטיס העסק</span>
                  )}
                </span>
                <input
                  type={field.type === "date" ? "date" : "text"}
                  dir={field.type === "url" ? "ltr" : undefined}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
                />
              </label>
            ))}
          </div>
        </>
      )}

      {/* 3. confirm */}
      <button
        onClick={() => setConfirmed((c) => !c)}
        className="mb-4 flex w-full items-start gap-2.5 rounded-xl border border-edge px-3 py-3 text-right transition hover:border-brand-edge"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            confirmed
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-edge-strong bg-card"
          }`}
        >
          {confirmed && <Check className="h-3.5 w-3.5" aria-hidden />}
        </span>
        <span className="text-sm font-medium text-ink">{spec.confirm}</span>
      </button>

      {error && <p className="mb-3 text-sm text-status-overdue">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit || pending}
          className="inline-flex items-center gap-2 rounded-xl bg-status-done px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          )}
          סיימתי את המשימה
        </button>
        {!canSubmit && (
          <span className="text-xs text-ink-muted">
            {!allStepsDone
              ? "סמנו את כל הצעדים"
              : !requiredFilled
                ? "מלאו את שדות החובה"
                : "אשרו את ההצהרה"}
          </span>
        )}
      </div>
    </div>
  );
}
