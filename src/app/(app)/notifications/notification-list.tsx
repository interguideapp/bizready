"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlertTriangle, CalendarClock, Check, RefreshCw } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import { Card } from "@/components/ui";
import { attentionHref, type AttentionItem } from "@/lib/live-attention";

const ICONS: Record<string, React.ReactNode> = {
  overdue: <AlertTriangle className="h-5 w-5 text-status-overdue" aria-hidden />,
  deadline: <CalendarClock className="h-5 w-5 text-status-progress" aria-hidden />,
  recurring: <RefreshCw className="h-5 w-5 text-brand-strong" aria-hidden />,
};

/**
 * The attention list.
 *
 * Takes merged items rather than table rows, because half of what belongs here
 * may never have been written to the table — see lib/live-attention.ts. A
 * derived item has no stored id, so there is nothing to mark read: it clears
 * itself when the condition behind it does.
 */
export function NotificationList({ items }: { items: AttentionItem[] }) {
  const [pending, startTransition] = useTransition();
  // Only stored items can be marked read, so the bulk action is offered only
  // when there is something it would actually affect.
  const hasUnreadStored = items.some((i) => i.storedId && !i.readAt);

  return (
    <div>
      {hasUnreadStored && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => startTransition(() => markAllNotificationsRead())}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-strong disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden />
            סימון הכל כנקרא
          </button>
        </div>
      )}

      <Card className="divide-y divide-edge-soft">
        {items.map((item) => (
          <Row key={item.key} item={item} onRead={(id) => startTransition(() => markNotificationRead(id))} />
        ))}
      </Card>
    </div>
  );
}

function Row({
  item,
  onRead,
}: {
  item: AttentionItem;
  onRead: (id: string) => void;
}) {
  const inner = (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 transition ${
        item.readAt ? "opacity-60" : "bg-brand-tint/30"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {ICONS[item.type] ?? <CalendarClock className="h-5 w-5 text-ink-faint" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{item.title}</p>
        {item.body && <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>}
        <p className="mt-1 text-xs text-ink-faint">
          {item.createdAt
            ? new Date(item.createdAt).toLocaleDateString("he-IL", {
                day: "numeric",
                month: "long",
              })
            : "מהבדיקה שעשינו עכשיו"}
        </p>
      </div>
      {!item.readAt && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
      )}
    </div>
  );

  const handleRead = () => {
    if (item.storedId && !item.readAt) onRead(item.storedId);
  };

  // attentionHref, not a template id: a document expiry has no task, so it used
  // to render as inert markup — the product told a user their אישור ניהול ספרים
  // had expired and gave them nowhere to go.
  const href = attentionHref(item);
  if (href) {
    return (
      <Link href={href} onClick={handleRead} className="block hover:bg-surface">
        {inner}
      </Link>
    );
  }

  // A notification with no task to open is not a control. It used to be a
  // <div onClick>, which meant a keyboard user could not mark it read at all —
  // so it is a real button when there is something to do, and plain markup
  // when there is not.
  if (item.storedId && !item.readAt) {
    return (
      <button onClick={handleRead} className="block w-full text-start hover:bg-surface">
        {inner}
      </button>
    );
  }
  return inner;
}
