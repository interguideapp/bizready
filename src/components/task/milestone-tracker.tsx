"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Hourglass, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/primitives";
import { advanceStage, revertStage } from "@/lib/actions";
import type { Stage } from "@/lib/content/milestones";
import type { TaskView } from "@/lib/task-view";

/**
 * אבני דרך — the task's real position, and the one button that moves it.
 *
 * This sits at the TOP of the task page, above the tabs, because the thing it
 * answers ("where am I and what now?") was previously reachable only by
 * opening the task, finding a tab called "לסגור", and using a status picker.
 * People did not find it, and those who did had to tell the product three
 * things it already knew.
 *
 * There is exactly one primary action here at any moment. Advancing derives
 * the status, the "waiting for" text and the follow-up date on the server, so
 * a submission is one tap rather than a form.
 */
export function MilestoneTracker({
  view,
  onComplete,
}: {
  view: TaskView;
  /** The final advance opens the evidence flow instead of writing `done`. */
  onComplete: () => void;
}) {
  const { chain, currentId, step, total, nextCompletes, resolvedFromStage } = view.milestones;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const index = chain.findIndex((s) => s.id === currentId);
  const current: Stage | undefined = chain[index];
  if (!current) return null;

  const next = chain[index + 1] ?? null;
  const finished = current.owner === "done";

  function act(fn: (id: string, from: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn(view.taskDbId, currentId);
      } catch (err) {
        // A stale view is the one failure with a real remedy, so it gets its
        // own message instead of a generic one.
        const raw = err instanceof Error ? err.message : String(err);
        setError(
          raw.includes("STALE_STAGE")
            ? "המשימה התקדמה במקום אחר. רעננו את הדף כדי לראות את המצב הנוכחי."
            : "לא הצלחנו לעדכן את השלב. נסו שוב."
        );
      }
    });
  }

  return (
    <section
      aria-labelledby="milestones-heading"
      className="os-card rounded-3xl p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            finished
              ? "bg-status-done-bg text-status-done"
              : current.owner === "them"
                ? "bg-status-progress-bg text-status-progress"
                : "bg-brand-tint text-brand-strong"
          }`}
        >
          {finished ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : current.owner === "them" ? (
            <Hourglass className="h-5 w-5" aria-hidden />
          ) : (
            <span className="tnum text-sm font-semibold">{step}</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-muted">
            <span id="milestones-heading">אבני דרך</span>
            {" · "}
            <span className="tnum">
              שלב {step} מתוך {total}
            </span>
          </p>
          <h2 className="text-title text-ink">{current.label}</h2>
          {current.hint && (
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{current.hint}</p>
          )}

          {/* The wait, stated as a promise about US rather than about the
              authority. We do not know when they will answer; we do know when
              we will remind you. */}
          {current.owner === "them" && view.followUpDate && (
            <p className="mt-1.5 text-xs text-ink-muted">
              נזכיר לכם לבדוק ב-
              <span className="tnum">
                {new Date(view.followUpDate).toLocaleDateString("he-IL")}
              </span>
            </p>
          )}

          {/* Honest about a guessed position. A task that predates this feature
              has no stored stage, so we placed it by its old status and say so
              rather than claiming a precision we do not have. */}
          {!resolvedFromStage && !finished && (
            <p className="mt-1.5 text-xs text-ink-muted">
              המצב הזה מבוסס על הסטטוס הקודם של המשימה. אם הוא לא מדויק — קדמו או
              חזרו שלב, ומכאן נעקוב בדיוק.
            </p>
          )}
        </div>
      </div>

      {/* ---------- the chain ---------- */}
      <ol className="mb-4 flex flex-col gap-0.5">
        {chain.map((s, i) => {
          const state = i < index ? "past" : i === index ? "current" : "future";
          return (
            <li key={s.id} className="flex items-center gap-2.5 py-1">
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  state === "past"
                    ? "bg-status-done/20 text-status-done"
                    : state === "current"
                      ? "bg-brand-600 text-white"
                      : "border border-edge text-ink-faint"
                }`}
              >
                {state === "past" ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={`text-sm ${
                  state === "current"
                    ? "font-semibold text-ink"
                    : state === "past"
                      ? "text-ink-muted line-through decoration-ink-faint/40"
                      : "text-ink-muted"
                }`}
              >
                {s.label}
              </span>
              {state === "current" && (
                <span className="sr-only">— כאן אנחנו נמצאים</span>
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl bg-status-overdue/10 p-2.5 text-sm text-status-overdue"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {!view.canEdit ? (
        view.readOnlyReason && <p className="text-sm text-ink-muted">{view.readOnlyReason}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {next && current.advance && (
            <Button
              onClick={() => (nextCompletes ? onComplete() : act(advanceStage))}
              loading={pending}
              size="lg"
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
              {current.advance}
            </Button>
          )}

          {finished && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-status-done">
              <Check className="h-4 w-4" aria-hidden />
              המשימה הושלמה
            </p>
          )}

          {/* A misclick needs a way back that is not the picker this replaced. */}
          {index > 0 && !finished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => act(revertStage)}
              disabled={pending}
              icon={<Undo2 className="h-3.5 w-3.5" aria-hidden />}
            >
              חזרה שלב אחד
            </Button>
          )}

          {finished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => act(revertStage)}
              disabled={pending}
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            >
              פתיחה מחדש
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
