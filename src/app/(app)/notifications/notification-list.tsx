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
  recurring: <RefreshCw className="h-5 w-5 text-brand-strong" aria-hidden />,
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
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-strong hover:text-brand-strong disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden />
            סמן הכל כנקרא
          </button>
        </div>
      )}

      <Card className="divide-y divide-edge-soft">
        {notifications.map((n) => {
          const inner = (
            <div
              className={`flex items-start gap-3 px-4 py-3.5 transition ${
                n.read_at ? "opacity-60" : "bg-brand-tint/30"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {ICONS[n.type] ?? (
                  <CalendarClock className="h-5 w-5 text-ink-faint" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-ink-faint">
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
              className="block hover:bg-surface"
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
