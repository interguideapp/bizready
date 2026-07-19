"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlertTriangle, CalendarClock, Check, RefreshCw } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import { Card } from "@/components/ui";
import type { NotificationRow } from "@/lib/data";

const ICONS: Record<string, React.ReactNode> = {
  overdue: <AlertTriangle className="h-5 w-5 text-status-overdue" aria-hidden />,
  deadline: <CalendarClock className="h-5 w-5 text-status-progress" aria-hidden />,
  recurring: <RefreshCw className="h-5 w-5 text-brand-600" aria-hidden />,
};

export function NotificationList({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const [pending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div>
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => startTransition(() => markAllNotificationsRead())}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden />
            סמן הכל כנקרא
          </button>
        </div>
      )}

      <Card className="divide-y divide-slate-100">
        {notifications.map((n) => {
          const inner = (
            <div
              className={`flex items-start gap-3 px-4 py-3.5 transition ${
                n.read_at ? "opacity-60" : "bg-brand-50/30"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {ICONS[n.type] ?? (
                  <CalendarClock className="h-5 w-5 text-slate-400" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(n.created_at).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              {!n.read_at && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
              )}
            </div>
          );

          const handleRead = () => {
            if (!n.read_at) startTransition(() => markNotificationRead(n.id));
          };

          return n.template_id ? (
            <Link
              key={n.id}
              href={`/tasks/${n.template_id}`}
              onClick={handleRead}
              className="block hover:bg-slate-50"
            >
              {inner}
            </Link>
          ) : (
            <div key={n.id} onClick={handleRead}>
              {inner}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
