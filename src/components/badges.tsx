import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  EyeOff,
} from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "לא התחלתי",
  in_progress: "בתהליך",
  done: "הושלם",
  not_relevant: "לא רלוונטי לי",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<
    TaskStatus,
    { cls: string; icon: React.ReactNode }
  > = {
    done: {
      cls: "bg-status-done-bg text-status-done",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    in_progress: {
      cls: "bg-status-progress-bg text-status-progress",
      icon: <CircleDashed className="h-3.5 w-3.5" />,
    },
    todo: {
      cls: "bg-status-todo-bg text-status-todo",
      icon: <Circle className="h-3.5 w-3.5" />,
    },
    not_relevant: {
      cls: "bg-surface-2 text-ink-faint",
      icon: <EyeOff className="h-3.5 w-3.5" />,
    },
  };
  const { cls, icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      {STATUS_LABELS[status]}
    </span>
  );
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "חובה",
  important: "חשוב",
  recommended: "מומלץ",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cls: Record<TaskPriority, string> = {
    critical: "bg-status-overdue-bg text-status-overdue",
    important: "bg-brand-tint text-brand-strong",
    recommended: "bg-surface-2 text-ink-muted",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls[priority]}`}
    >
      {priority === "critical" && <AlertTriangle className="h-3.5 w-3.5" />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-overdue-bg px-2.5 py-1 text-xs font-medium text-status-overdue">
        <AlertTriangle className="h-3.5 w-3.5" />
        באיחור
      </span>
    );
  if (days <= 7)
    return (
      <span className="rounded-full bg-status-progress-bg px-2.5 py-1 text-xs font-medium text-status-progress">
        {days === 0 ? "היום" : `בעוד ${days} ימים`}
      </span>
    );
  return (
    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
      עד {due.toLocaleDateString("he-IL")}
    </span>
  );
}
