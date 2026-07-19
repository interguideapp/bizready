"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { setTaskStatus } from "@/lib/actions";
import { DueBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export function TaskRow({
  taskId,
  templateId,
  title,
  priority,
  status,
  dueDate,
}: {
  taskId: string;
  templateId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const done = status === "done";

  function toggle() {
    startTransition(() => setTaskStatus(taskId, done ? "todo" : "done"));
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 ${
        status === "not_relevant" ? "opacity-50" : ""
      }`}
    >
      <button
        onClick={toggle}
        disabled={pending || status === "not_relevant"}
        aria-label={done ? `סמן את "${title}" כלא הושלם` : `סמן את "${title}" כהושלם`}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
          done
            ? "border-status-done bg-status-done text-white"
            : "border-slate-300 bg-white hover:border-brand-500"
        }`}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />
        ) : done ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : null}
      </button>

      <Link href={`/tasks/${templateId}`} className="min-w-0 flex-1">
        <p
          className={`truncate font-medium ${
            done ? "text-slate-400 line-through" : "text-slate-900"
          }`}
        >
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {!done && <PriorityBadge priority={priority} />}
          {status === "in_progress" && <StatusBadge status="in_progress" />}
          {!done && <DueBadge dueDate={dueDate} />}
        </div>
      </Link>
    </div>
  );
}
