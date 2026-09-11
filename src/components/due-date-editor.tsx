"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { DueBadge } from "@/components/badges";
import { DeadlinePicker } from "@/components/task/deadline-picker";
import { formatHe } from "@/lib/deadline-options";

/**
 * The date row in the task header: what is due, and the control to set a target.
 *
 * This used to hide the editor entirely whenever `basis` was "statutory", on
 * the reasoning that a date fixed by law is not the user's to change. The date
 * is not — but the reminder is, and that reasoning left people unable to ask for
 * a head start on precisely the filings that carry penalties. Migration 028
 * separates the two columns so both can exist: the law's date stays, and a
 * personal target sits beside it.
 */
export function DueDateControl({
  taskId,
  templateId,
  dueDate,
  basis = "recommended",
  todayIso,
  personalDueDate,
  statutoryDueDate,
  canEdit = true,
}: {
  taskId: string;
  templateId: string;
  dueDate: string | null;
  basis?: "statutory" | "recommended";
  todayIso: string;
  personalDueDate: string | null;
  statutoryDueDate: string | null;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DeadlinePicker
        taskId={taskId}
        templateId={templateId}
        todayIso={todayIso}
        personalDueDate={personalDueDate}
        statutoryDueDate={statutoryDueDate}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <DueBadge dueDate={dueDate} basis={basis} />

      {/* The personal target, shown as a separate fact from the legal date so
          the two are never confused for one another. */}
      {personalDueDate && (
        <span className="inline-flex items-center gap-1 rounded-full border border-edge px-2.5 py-1 text-xs text-ink-soft">
          <CalendarClock className="h-3.5 w-3.5 text-brand-400" aria-hidden />
          <span>
            היעד שלכם: <span className="tnum">{formatHe(personalDueDate)}</span>
          </span>
        </span>
      )}

      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {personalDueDate ? "שינוי היעד" : "קביעת יעד"}
        </button>
      )}
    </span>
  );
}
