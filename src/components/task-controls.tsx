"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { saveTaskNotes, setTaskStatus } from "@/lib/actions";
import { CompleteTaskFlow } from "@/components/complete-task-flow";
import {
  DISMISSAL_EXPLAINER,
  DISMISSAL_LABEL,
  type Dismissal,
} from "@/lib/task-status";
import type { CompletionSpec } from "@/lib/types";

/**
 * The two task actions a milestone chain cannot decide on its own.
 *
 * This used to be the whole status model: a four-button grid (todo / בתהליך /
 * ממתין / לא רלוונטי) plus a dialog asking the user to type what they were
 * waiting for and pick a follow-up date. MilestoneTracker replaced all of it,
 * because the chain already knows who holds the ball at each stage and when we
 * should look again.
 *
 * What genuinely cannot be derived stays here:
 *   - closing a task, which must capture evidence into the audit trail;
 *   - removing a task, which needs a REASON, because "not about me" gates a
 *     dependent statutory duty while "handled elsewhere" satisfies it.
 *
 * `autoOpenFlow` lets the tracker's final milestone open the evidence flow
 * directly, so finishing is one tap from the top of the page instead of a hunt
 * through a tab.
 */
export function StatusPicker({
  taskId,
  steps,
  completion,
  unlocks = [],
  autoOpenFlow = false,
}: {
  taskId: string;
  steps: string[];
  completion?: CompletionSpec;
  unlocks?: string[];
  autoOpenFlow?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showFlow, setShowFlow] = useState(autoOpenFlow);
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissal, setDismissal] = useState<Dismissal>("not_applicable");
  const [dismissNote, setDismissNote] = useState("");

  function saveDismissal() {
    startTransition(async () => {
      await setTaskStatus(taskId, "not_relevant", {
        dismissal,
        dismissalNote: dismissNote.trim() || null,
      });
      setShowDismiss(false);
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
    <div className="flex flex-col gap-3">
      {/*
        The four-button status grid and the "על מה ממתינים?" dialog used to live
        here. Both are gone: MilestoneTracker owns where a task is, and derives
        the status, the waiting reason and the follow-up date from the task's own
        milestone chain. Asking the user to re-enter all three was the double
        work they described.

        What is left is the two things a milestone cannot decide on its own.
      */}

      {/* Closing a task is never one click: the evidence goes in the trail. */}
      <button
        onClick={() => setShowFlow(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-status-done px-6 py-3 font-semibold text-white transition hover:opacity-90"
      >
        <Check className="h-4 w-4" aria-hidden />
        סיימתי — בואו נסגור את זה
      </button>

      {/* Removing a task needs a REASON, because the two reasons have opposite
          consequences for any statutory duty that depends on it. */}
      {!showDismiss ? (
        <button
          onClick={() => setShowDismiss(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:border-edge-strong"
        >
          <XCircle className="h-4 w-4" aria-hidden />
          המשימה לא רלוונטית עבורי
        </button>
      ) : (
        <div className="rounded-xl border border-edge bg-card p-4">
          <p className="mb-1 text-sm font-semibold text-ink">למה להסיר את המשימה?</p>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">
            לשתי התשובות יש משמעות שונה לגמרי עבור חובות שתלויות במשימה הזאת.
          </p>
          <div className="flex flex-col gap-2" role="group" aria-label="סוג ההסרה">
            {(["not_applicable", "handled_externally"] as Dismissal[]).map((d) => {
              const active = dismissal === d;
              return (
                <button
                  key={d}
                  aria-pressed={active}
                  onClick={() => setDismissal(d)}
                  className={`rounded-xl border p-3 text-start transition ${
                    active
                      ? "border-brand-600 bg-brand-tint"
                      : "border-edge bg-card hover:border-edge-strong"
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink">
                    {DISMISSAL_LABEL[d]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    {DISMISSAL_EXPLAINER[d]}
                  </span>
                </button>
              );
            })}
          </div>

          <label
            htmlFor="dismiss-note"
            className="mt-3 mb-1 block text-xs font-medium text-ink-muted"
          >
            {dismissal === "handled_externally"
              ? "מי מטפל בזה? (יישמר בתיק ההוכחות)"
              : "למה זה לא רלוונטי? (לא חובה)"}
          </label>
          <input
            id="dismiss-note"
            value={dismissNote}
            onChange={(e) => setDismissNote(e.target.value)}
            placeholder={
              dismissal === "handled_externally"
                ? 'למשל: רו"ח מגיש את הדוח מדי שנה'
                : "למשל: אין לי אתר ולא מתכוון להקים"
            }
            className="mb-3 w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />

          <div className="flex gap-2">
            <button
              onClick={saveDismissal}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              הסרה מהתכנית
            </button>
            <button
              onClick={() => setShowDismiss(false)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
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
      {/* aria-live, so a blind user learns the note saved. This was previously
          a silent tick glyph in the text — a character doing an icon's job,
          which no screen reader announces as a confirmation. */}
      <p
        className="mt-1 flex h-4 items-center gap-1 text-xs text-ink-muted"
        aria-live="polite"
      >
        {pending ? (
          "שומר..."
        ) : saved ? (
          <>
            <Check className="h-3.5 w-3.5 text-status-done" aria-hidden />
            נשמר
          </>
        ) : (
          "נשמר אוטומטית"
        )}
      </p>
    </div>
  );
}
