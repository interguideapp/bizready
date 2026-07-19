import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  PartyPopper,
  UserRound,
} from "lucide-react";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { CategoryIcon } from "@/components/category-icon";
import { MiniRing, ScoreRing } from "@/components/score-ring";
import { Card, Disclaimer } from "@/components/ui";
import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getDocuments,
  getProducts,
} from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore, nextSteps } from "@/lib/rules-engine";

export default async function DashboardPage() {
  const business = (await getBusiness())!;
  const [tasks, products, documents] = await Promise.all([
    getBusinessTasks(business.id),
    getProducts(business.id),
    getDocuments(business.id),
  ]);

  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const stepIds = nextSteps(tasks, TEMPLATES_BY_ID, 3);
  const taskByTemplate = new Map(tasks.map((t) => [t.template_id, t]));
  const profile = computeProfileCompleteness(business, {
    products: products.length,
    documents: documents.length,
  });

  const relevant = tasks.filter((t) => t.is_relevant);
  const doneCount = relevant.filter((t) => t.status === "done").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = relevant.filter(
    (t) =>
      (t.status === "todo" || t.status === "in_progress") &&
      t.due_date &&
      t.due_date < today
  ).length;

  const upcoming = relevant
    .filter(
      (t) => (t.status === "todo" || t.status === "in_progress") && t.due_date
    )
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 4);

  const scoreByCategory = new Map(score.byCategory.map((c) => [c.category_id, c]));

  return (
    <div>
      <header className="mb-5">
        <p className="text-sm text-ink-muted">שלום 👋</p>
        <h1 className="text-2xl font-bold text-ink">{business.name}</h1>
      </header>

      {/* status chips — the state of the business at a glance */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <Card className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
          <span className="flex items-center gap-1.5 text-lg font-bold text-ink">
            <CheckCircle2 className="h-4 w-4 text-status-done" aria-hidden />
            {doneCount}/{relevant.length}
          </span>
          <span className="text-[11px] font-medium text-ink-muted">משימות הושלמו</span>
        </Card>
        <Card
          className={`flex flex-col items-center gap-0.5 px-2 py-3 text-center ${
            overdueCount > 0 ? "ring-1 ring-status-overdue/30" : ""
          }`}
        >
          <span className="flex items-center gap-1.5 text-lg font-bold text-ink">
            <AlertTriangle
              className={`h-4 w-4 ${overdueCount > 0 ? "text-status-overdue" : "text-ink-faint"}`}
              aria-hidden
            />
            {overdueCount}
          </span>
          <span className="text-[11px] font-medium text-ink-muted">באיחור</span>
        </Card>
        <Link href="/business">
          <Card className="flex h-full flex-col items-center gap-0.5 px-2 py-3 text-center transition hover:border-brand-300">
            <span className="flex items-center gap-1.5 text-lg font-bold text-ink">
              <UserRound className="h-4 w-4 text-brand-500" aria-hidden />
              {profile.percent}%
            </span>
            <span className="text-[11px] font-medium text-ink-muted">פרופיל עסקי</span>
          </Card>
        </Link>
      </div>

      {/* readiness hero */}
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
                className="flex items-center gap-2.5 rounded-xl border border-edge-soft p-2.5 transition hover:border-brand-edge hover:bg-brand-tint/40"
              >
                <div className="relative">
                  <MiniRing score={s.score} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-soft">
                    {s.score}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-ink-muted">
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
          <h2 className="font-bold text-ink">הצעדים הבאים שלך</h2>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:opacity-80"
          >
            כל המשימות
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {stepIds.length === 0 ? (
          <Card className="p-6 text-center">
            <PartyPopper className="mx-auto h-8 w-8 text-status-done" aria-hidden />
            <p className="mt-2 font-semibold text-ink">
              סיימתם הכל — כל הכבוד!
            </p>
            <p className="text-sm text-ink-muted">
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                      <CategoryIcon name={category.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {template.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={template.priority} />
                        <DueBadge dueDate={task.due_date} />
                      </div>
                    </div>
                    <ArrowLeft
                      className="h-5 w-5 shrink-0 text-ink-faint transition group-hover:text-brand-strong"
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
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
            <CalendarClock className="h-4.5 w-4.5 text-ink-faint" aria-hidden />
            דדליינים קרובים
          </h2>
          <Card className="divide-y divide-edge-soft">
            {upcoming.map((t) => {
              const template = TEMPLATES_BY_ID.get(t.template_id);
              if (!template) return null;
              return (
                <Link
                  key={t.id}
                  href={`/tasks/${t.template_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface/60"
                >
                  <span className="truncate text-sm font-medium text-ink">
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
