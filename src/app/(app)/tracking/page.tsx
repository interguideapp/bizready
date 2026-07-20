import Link from "next/link";
import {
  CalendarClock,
  Check,
  CircleDashed,
  History,
  Hourglass,
  RotateCcw,
} from "lucide-react";
import { STATUS_LABELS } from "@/components/badges";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks, getTaskEvents } from "@/lib/data";
import type { BusinessTask, TaskStatus } from "@/lib/types";

/** Board columns — everything the user is tracking, grouped by state. */
const COLUMNS: { status: TaskStatus; icon: React.ReactNode; tone: string }[] = [
  {
    status: "waiting",
    icon: <Hourglass className="h-4 w-4" aria-hidden />,
    tone: "text-brand-strong",
  },
  {
    status: "in_progress",
    icon: <CircleDashed className="h-4 w-4" aria-hidden />,
    tone: "text-status-progress",
  },
  {
    status: "done",
    icon: <Check className="h-4 w-4" aria-hidden />,
    tone: "text-status-done",
  },
];

export default async function TrackingPage() {
  const business = (await getBusiness())!;
  const [tasks, events] = await Promise.all([
    getBusinessTasks(business.id),
    getTaskEvents(business.id),
  ]);

  const relevant = tasks.filter((t) => t.is_relevant);
  const byStatus = new Map<TaskStatus, BusinessTask[]>();
  for (const t of relevant) {
    const list = byStatus.get(t.status) ?? [];
    list.push(t);
    byStatus.set(t.status, list);
  }

  const hasAnything = COLUMNS.some((c) => (byStatus.get(c.status) ?? []).length > 0);

  return (
    <div>
      <PageTitle
        title="מעקב"
        subtitle="מה טופל, מה בתהליך, ועל מה אנחנו ממתינים"
      />

      {!hasAnything ? (
        <Card>
          <EmptyState
            icon={<History className="h-6 w-6" aria-hidden />}
            title="עוד לא התחלת לעבוד על משימות"
            subtitle="ברגע שתסמנו משימה כבתהליך או תסגרו אותה — הכל יופיע כאן"
            action={
              <Link
                href="/tasks"
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                למשימות
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {COLUMNS.map(({ status, icon, tone }) => {
            const list = byStatus.get(status) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={status}>
                <h2 className={`mb-2.5 flex items-center gap-2 font-bold ${tone}`}>
                  {icon}
                  {STATUS_LABELS[status]}
                  <span className="mr-auto text-xs font-normal text-ink-muted">
                    {list.length}
                  </span>
                </h2>
                <Card className="divide-y divide-edge-soft">
                  {list.map((task) => {
                    const template = TEMPLATES_BY_ID.get(task.template_id);
                    if (!template) return null;
                    return (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.template_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {template.title}
                          </p>
                          {status === "waiting" && task.waiting_for && (
                            <p className="truncate text-xs text-ink-muted">
                              {task.waiting_for}
                            </p>
                          )}
                          {status === "done" && task.completed_at && (
                            <p className="text-xs text-ink-muted">
                              הושלם ב-
                              {new Date(task.completed_at).toLocaleDateString("he-IL")}
                            </p>
                          )}
                        </div>
                        {status === "waiting" && task.follow_up_date && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-strong">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            {new Date(
                              task.follow_up_date + "T00:00:00"
                            ).toLocaleDateString("he-IL")}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {/* activity log */}
      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
            <History className="h-4.5 w-4.5 text-ink-faint" aria-hidden />
            יומן פעילות
          </h2>
          <Card className="divide-y divide-edge-soft">
            {events.map((event) => {
              const template = TEMPLATES_BY_ID.get(event.template_id);
              return (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0">
                    {event.kind === "completed" ? (
                      <Check className="h-4 w-4 text-status-done" aria-hidden />
                    ) : event.kind === "reopened" ? (
                      <RotateCcw className="h-4 w-4 text-status-progress" aria-hidden />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-ink-faint" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className="font-medium">
                        {template?.title ?? event.template_id}
                      </span>
                      <span className="text-ink-muted">
                        {event.kind === "completed"
                          ? " — הושלמה"
                          : event.kind === "reopened"
                            ? " — נפתחה מחדש"
                            : ` — ${STATUS_LABELS[event.to_status as TaskStatus] ?? event.to_status}`}
                      </span>
                    </p>
                    {event.detail && (
                      <p className="truncate text-xs text-ink-muted">{event.detail}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {new Date(event.created_at).toLocaleDateString("he-IL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
