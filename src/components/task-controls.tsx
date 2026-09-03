"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarClock, Check, Loader2, RotateCcw } from "lucide-react";
import { saveTaskNotes, setTaskStatus } from "@/lib/actions";
import { CompleteTaskFlow } from "@/components/complete-task-flow";
import { STATUS_LABELS } from "@/components/badges";
import type { CompletionSpec, TaskStatus } from "@/lib/types";

const OPEN_STATUSES: Exclude<TaskStatus, "done">[] = [
  "todo",
  "in_progress",
  "waiting",
  "not_relevant",
];

/**
 * Status control. Everything except "done" is a direct switch; closing a task
 * always opens the completion flow so it can never be a single click.
 */
export function StatusPicker({
  taskId,
  status,
  steps,
  completion,
  waitingFor,
  followUpDate,
  unlocks = [],
}: {
  taskId: string;
  status: TaskStatus;
  steps: string[];
  completion?: CompletionSpec;
  waitingFor: string | null;
  followUpDate: string | null;
  unlocks?: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<TaskStatus | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const [reason, setReason] = useState(waitingFor ?? "");
  const [followUp, setFollowUp] = useState(followUpDate ?? "");

  function pick(s: Exclude<TaskStatus, "done">) {
    if (s === "waiting") {
      setShowWaiting(true);
      return;
    }
    setTarget(s);
    startTransition(() => setTaskStatus(taskId, s));
  }

  function saveWaiting() {
    setTarget("waiting");
    startTransition(async () => {
      await setTaskStatus(taskId, "waiting", {
        waitingFor: reason.trim() || null,
        followUpDate: followUp || null,
      });
      setShowWaiting(false);
    });
  }

  if (showFlow) {
    return (
      <CompleteTaskFlow
        taskId={taskId}
        steps={steps}
        completion={completion}
        unlocks={unlocks}
        onCancel={() => setShowFlow(false)}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="סטטוס המשימה">
        {OPEN_STATUSES.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              aria-pressed={active}
              disabled={pending}
              onClick={() => pick(s)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? s === "in_progress"
                    ? "border-status-progress bg-status-progress-bg text-status-progress"
                    : s === "waiting"
                      ? "border-brand-edge bg-brand-tint text-brand-strong"
                      : "border-brand-600 bg-brand-tint text-brand-strong"
                  : "border-edge bg-card text-ink-soft hover:border-edge-strong"
              }`}
            >
              {pending && target === s ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                active && <Check className="h-4 w-4" aria-hidden />
              )}
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {/* waiting details */}
      {showWaiting && (
        <div className="mt-3 rounded-xl border border-brand-edge bg-brand-tint/40 p-4">
          <p className="mb-2 text-sm font-semibold text-ink">על מה ממתינים?</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="למשל: הוגשה בקשה לרשות, ממתין לתשובה"
            className="mb-2.5 w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            תזכורת לבדיקה בתאריך
          </label>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="mb-3 w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
          <div className="flex gap-2">
            <button
              onClick={saveWaiting}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              שמירה
            </button>
            <button
              onClick={() => setShowWaiting(false)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* current waiting summary */}
      {status === "waiting" && !showWaiting && (waitingFor || followUpDate) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-edge bg-brand-tint/30 px-3 py-2.5 text-sm">
          {waitingFor && <span className="text-ink-soft">{waitingFor}</span>}
          {followUpDate && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              בדיקה ב-{new Date(followUpDate + "T00:00:00").toLocaleDateString("he-IL")}
            </span>
          )}
        </div>
      )}

      {/* the only way to close a task */}
      <div className="mt-3">
        {status === "done" ? (
          <button
            onClick={() => pick("in_progress")}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:border-edge-strong disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            פתיחה מחדש
          </button>
        ) : (
          <button
            onClick={() => setShowFlow(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-status-done px-6 py-3 font-semibold text-white transition hover:opacity-90"
          >
            <Check className="h-4 w-4" aria-hidden />
            סיימתי — בואו נסגור את זה
          </button>
        )}
      </div>
    </div>
  );
}

export function NotesEditor({
  taskId,
  initialNotes,
}: {
  taskId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save() {
    startTransition(async () => {
      await saveTaskNotes(taskId, notes);
      setSaved(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== initialNotes && save()}
        rows={3}
        placeholder="הערות אישיות — מספרי אסמכתא, עם מי דיברתם, מה נשאר..."
        className="w-full rounded-xl border border-edge bg-card px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
      />
      <p className="mt-1 h-4 text-xs text-ink-faint">
        {pending ? "שומר..." : saved ? "✓ נשמר" : "נשמר אוטומטית"}
      </p>
    </div>
  );
}
