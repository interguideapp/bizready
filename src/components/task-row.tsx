import Link from "next/link";
import { Check, ChevronLeft, CircleDashed, Hourglass, Lock, Unlock, Zap } from "lucide-react";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { isStatutoryFiling } from "@/lib/compliance";
import type { NodeState } from "@/lib/journey";
import type { TaskPriority, TaskStatus } from "@/lib/types";

/**
 * A task in the list. Journey-aware: locked tasks show what unlocks them, the
 * next recommended task is highlighted, and tasks that unblock others say so.
 */
export function TaskRow({
  templateId,
  title,
  priority,
  status,
  dueDate,
  waitingFor,
  followUpDate,
  state,
  blockedBy,
  unlocksCount = 0,
  isNext = false,
}: {
  templateId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  waitingFor?: string | null;
  followUpDate?: string | null;
  state?: NodeState;
  blockedBy?: string[];
  unlocksCount?: number;
  isNext?: boolean;
}) {
  const done = status === "done";
  const locked = state === "locked";

  return (
    <Link
      href={`/tasks/${templateId}`}
      className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface/60 ${
        status === "not_relevant" ? "opacity-50" : ""
      } ${locked ? "opacity-70" : ""} ${isNext ? "bg-brand-tint/30" : ""}`}
    >
      <StatusDot status={status} locked={locked} isNext={isNext} />

      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${done ? "text-ink-muted line-through" : "text-ink"}`}>
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {isNext && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
              <Zap className="h-3 w-3" aria-hidden />
              הצעד הבא
            </span>
          )}
          {!done && !locked && <PriorityBadge priority={priority} />}
          {!done && !locked && status !== "waiting" && (
            <DueBadge dueDate={dueDate} basis={isStatutoryFiling(templateId) ? "statutory" : "recommended"} />
          )}
          {locked && blockedBy && blockedBy.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
              <Lock className="h-3 w-3" aria-hidden />
              נפתח אחרי: {blockedBy[0]}{blockedBy.length > 1 ? ` +${blockedBy.length - 1}` : ""}
            </span>
          )}
          {!done && !locked && unlocksCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-strong">
              <Unlock className="h-3 w-3" aria-hidden />
              פותח {unlocksCount}
            </span>
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

function StatusDot({ status, locked, isNext }: { status: TaskStatus; locked?: boolean; isNext?: boolean }) {
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
  if (locked)
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-edge-soft text-ink-faint">
        <Lock className="h-3 w-3" aria-hidden />
      </span>
    );
  return (
    <span className={`h-6 w-6 shrink-0 rounded-lg border-2 ${isNext ? "border-brand-500" : "border-edge-strong"}`} />
  );
}
