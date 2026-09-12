import { aheadLabel, lateLabel } from "@/lib/he-distance";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  EyeOff,
  Hourglass,
} from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "לא התחלתי",
  in_progress: "בתהליך",
  waiting: "ממתין לגורם חיצוני",
  done: "הושלם",
  not_relevant: "לא רלוונטי לי",
};

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

/**
 * `statutory` = a real filing deadline (may show a red "עבר המועד").
 * `recommended` = a suggested date (never red — a slipped recommendation is
 * not an "איחור"). This is the honest framing the whole product rests on.
 */
export function DueBadge({
  dueDate,
  basis = "recommended",
}: {
  dueDate: string | null;
  basis?: "statutory" | "recommended";
}) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const dateStr = due.toLocaleDateString("he-IL");

  if (days < 0) {
    if (basis === "statutory")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-overdue-bg px-2.5 py-1 text-xs font-medium text-status-overdue">
          <AlertTriangle className="h-3.5 w-3.5" />
          {lateLabel(-days)}
        </span>
      );
    // a recommendation that slipped — neutral, no alarm
    return (
      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
        היה מומלץ עד {dateStr}
      </span>
    );
  }
  if (days <= 7)
    return (
      <span className="rounded-full bg-status-progress-bg px-2.5 py-1 text-xs font-medium text-status-progress">
        {aheadLabel(days)}
      </span>
    );
  return (
    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
      {basis === "statutory" ? "עד" : "מומלץ עד"} {dateStr}
    </span>
  );
}
