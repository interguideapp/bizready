"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTaskStep } from "@/lib/actions";

/**
 * The real steps of a task, as a checkable stepper. Tick them off as you go —
 * progress and the current step are always visible, so tracking a task is a
 * simple "where am I in this?" instead of a wall of text.
 */
export function StepTracker({
  taskId,
  steps,
  doneIndices,
}: {
  taskId: string;
  steps: string[];
  doneIndices: number[];
}) {
  const initial = new Set(doneIndices);
  const [done, setDone] = useOptimistic(
    initial,
    (state: Set<number>, { index, value }: { index: number; value: boolean }) => {
      const next = new Set(state);
      if (value) next.add(index);
      else next.delete(index);
      return next;
    }
  );
  const [, startTransition] = useTransition();

  const doneCount = steps.filter((_, i) => done.has(i)).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const currentIndex = steps.findIndex((_, i) => !done.has(i)); // first not-done

  function toggle(i: number) {
    const value = !done.has(i);
    startTransition(async () => {
      setDone({ index: i, value });
      await toggleTaskStep(taskId, i, value);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">
          {doneCount === steps.length ? "כל השלבים הושלמו 🎉" : `שלב ${Math.min(doneCount + 1, steps.length)} מתוך ${steps.length}`}
        </span>
        <span className="tnum text-xs text-ink-muted">{pct}%</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const isDone = done.has(i);
          const isCurrent = i === currentIndex;
          const last = i === steps.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-3">
              {/* connector line */}
              {!last && (
                <span
                  className={`absolute right-[13px] top-7 h-[calc(100%-1rem)] w-0.5 ${isDone ? "bg-brand-500/50" : "bg-edge"}`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={isDone}
                aria-label={`שלב ${i + 1}: ${step}`}
                className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isDone
                    ? "border-brand-500 bg-brand-500 text-white"
                    : isCurrent
                      ? "border-brand-500 bg-brand-tint text-brand-strong ring-4 ring-brand-edge/30"
                      : "border-edge-strong bg-card text-ink-faint hover:border-brand-edge"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden /> : <span className="tnum text-xs font-bold">{i + 1}</span>}
              </button>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={`flex-1 pt-0.5 text-start text-sm leading-relaxed transition ${
                  isDone ? "text-ink-faint line-through decoration-edge-strong" : isCurrent ? "font-semibold text-ink" : "text-ink-soft"
                }`}
              >
                {step}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
