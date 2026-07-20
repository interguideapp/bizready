"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { setTaskDueDate } from "@/lib/actions";
import { DueBadge } from "@/components/badges";

/** Lets the user set/change/clear a personal deadline on a task. */
export function DueDateEditor({
  taskId,
  dueDate,
}: {
  taskId: string;
  dueDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dueDate ?? "");
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    startTransition(async () => {
      await setTaskDueDate(taskId, next);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {dueDate ? "שינוי דדליין" : "קביעת דדליין"}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-edge bg-card px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
      />
      <button
        onClick={() => value && save(value)}
        disabled={pending || !value}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        שמירה
      </button>
      {dueDate && (
        <button
          onClick={() => save(null)}
          disabled={pending}
          className="rounded-lg p-1 text-ink-faint hover:text-status-overdue"
          aria-label="הסרת דדליין"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** The badge + edit control together, for the task header. */
export function DueDateControl({
  taskId,
  dueDate,
}: {
  taskId: string;
  dueDate: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <DueBadge dueDate={dueDate} />
      <DueDateEditor taskId={taskId} dueDate={dueDate} />
    </span>
  );
}
