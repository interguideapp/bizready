import Link from "next/link";
import { ArrowLeft, CalendarClock, PartyPopper } from "lucide-react";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { CategoryIcon } from "@/components/category-icon";
import { MiniRing, ScoreRing } from "@/components/score-ring";
import { Card, Disclaimer } from "@/components/ui";
import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks } from "@/lib/data";
import { computeScore, nextSteps } from "@/lib/rules-engine";

export default async function DashboardPage() {
  const business = (await getBusiness())!;
  const tasks = await getBusinessTasks(business.id);
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const stepIds = nextSteps(tasks, TEMPLATES_BY_ID, 3);
  const taskByTemplate = new Map(tasks.map((t) => [t.template_id, t]));

  const upcoming = tasks
    .filter(
      (t) =>
        t.is_relevant &&
        (t.status === "todo" || t.status === "in_progress") &&
        t.due_date
    )
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 4);

  const scoreByCategory = new Map(score.byCategory.map((c) => [c.category_id, c]));

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-slate-500">שלום 👋</p>
        <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
      </header>

      {/* score hero */}
      <Card className="flex flex-col items-center gap-6 p-6 md:flex-row md:justify-between md:px-10">
        <ScoreRing score={score.overall} />
        <div className="grid w-full flex-1 grid-cols-2 gap-2.5 md:max-w-sm">
          {CATEGORIES.map((c) => {
            const s = scoreByCategory.get(c.id);
            if (!s) return null;
            return (
              <Link
                key={c.id}
                href={`/tasks?category=${c.id}`}
                className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="relative">
                  <MiniRing score={s.score} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                    {s.score}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {s.done}/{s.total} הושלמו
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* next steps */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">הצעדים הבאים שלך</h2>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            כל המשימות
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {stepIds.length === 0 ? (
          <Card className="p-6 text-center">
            <PartyPopper className="mx-auto h-8 w-8 text-status-done" aria-hidden />
            <p className="mt-2 font-semibold text-slate-800">
              סיימתם הכל — כל הכבוד!
            </p>
            <p className="text-sm text-slate-500">
              נעדכן כאן כשמשימה מחזורית תחזור או כשהרגולציה תשתנה
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {stepIds.map((id, i) => {
              const template = TEMPLATES_BY_ID.get(id)!;
              const task = taskByTemplate.get(id)!;
              const category = CATEGORIES_BY_ID.get(template.category_id)!;
              return (
                <Link
                  key={id}
                  href={`/tasks/${id}`}
                  className="animate-fade-up group"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <Card className="flex items-center gap-4 p-4 transition group-hover:border-brand-300 group-hover:shadow-md">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <CategoryIcon name={category.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {template.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={template.priority} />
                        <DueBadge dueDate={task.due_date} />
                      </div>
                    </div>
                    <ArrowLeft
                      className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand-600"
                      aria-hidden
                    />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* upcoming deadlines */}
      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <CalendarClock className="h-4.5 w-4.5 text-slate-400" aria-hidden />
            דדליינים קרובים
          </h2>
          <Card className="divide-y divide-slate-100">
            {upcoming.map((t) => {
              const template = TEMPLATES_BY_ID.get(t.template_id);
              if (!template) return null;
              return (
                <Link
                  key={t.id}
                  href={`/tasks/${t.template_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
                >
                  <span className="truncate text-sm font-medium text-slate-800">
                    {template.title}
                  </span>
                  <DueBadge dueDate={t.due_date} />
                </Link>
              );
            })}
          </Card>
        </section>
      )}

      <Disclaimer />
    </div>
  );
}
