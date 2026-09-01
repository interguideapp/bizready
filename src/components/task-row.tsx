import Link from "next/link";
import { Check, ChevronLeft, CircleDashed, Hourglass } from "lucide-react";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { isStatutoryFiling } from "@/lib/compliance";
import type { TaskPriority, TaskStatus } from "@/lib/types";

/**
 * A task in the list. Deliberately has no "tick to complete" control — closing a
 * task happens in the task page through the completion flow.
 */
export function TaskRow({
  templateId,
  title,
  priority,
  status,
  dueDate,
  waitingFor,
  followUpDate,
}: {
  templateId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  waitingFor?: string | null;
  followUpDate?: string | null;
}) {
  const done = status === "done";

  return (
    <Link
      href={`/tasks/${templateId}`}
      className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface/60 ${
        status === "not_relevant" ? "opacity-50" : ""
      }`}
    >
      <StatusDot status={status} />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-medium ${
            done ? "text-ink-muted line-through" : "text-ink"
          }`}
        >
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {!done && <PriorityBadge priority={priority} />}
          {!done && status !== "waiting" && (
            <DueBadge
              dueDate={dueDate}
              basis={isStatutoryFiling(templateId) ? "statutory" : "recommended"}
            />
          )}
          {status === "waiting" && (
            <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-strong">
              {followUpDate
                ? `בדיקה ב-${new Date(followUpDate + "T00:00:00").toLocaleDateString("he-IL")}`
                : waitingFor || "ממתין"}
            </span>
          )}
        </div>
      </div>

      <ChevronLeft className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
    </Link>
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  if (status === "done")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-status-done text-white">
        <Check className="h-4 w-4" aria-hidden />
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-status-progress-bg text-status-progress">
        <CircleDashed className="h-4 w-4" aria-hidden />
      </span>
    );
  if (status === "waiting")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-strong">
        <Hourglass className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  return (
    <span className="h-6 w-6 shrink-0 rounded-lg border-2 border-edge-strong" />
  );
}
