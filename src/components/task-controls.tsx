"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveTaskNotes, setTaskStatus } from "@/lib/actions";
import { STATUS_LABELS } from "@/components/badges";
import type { TaskStatus } from "@/lib/types";

const ORDER: TaskStatus[] = ["todo", "in_progress", "done", "not_relevant"];

export function StatusPicker({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<TaskStatus | null>(null);

  function pick(s: TaskStatus) {
    setTarget(s);
    startTransition(() => setTaskStatus(taskId, s));
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="סטטוס המשימה">
      {ORDER.map((s) => {
        const active = status === s;
        return (
          <button
            key={s}
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => pick(s)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? s === "done"
                  ? "border-status-done bg-status-done-bg text-status-done"
                  : s === "in_progress"
                    ? "border-status-progress bg-status-progress-bg text-status-progress"
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
