import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { PriorityBadge } from "@/components/badges";
import { TaskRow } from "@/components/task-row";
import { Card, Disclaimer, FadeIn, PageTitle } from "@/components/ui";
import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks } from "@/lib/data";
import { buildJourney, type Journey, type JourneyNode } from "@/lib/journey";
import { taskImportance, type Stage } from "@/lib/priority";
import { LIFE_STAGES, type BusinessTask, type Category } from "@/lib/types";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: activeCategory } = await searchParams;
  const business = (await getBusiness())!;
  const tasks = await getBusinessTasks(business.id);

  const relevant = tasks.filter((t) => t.is_relevant);
  const byCategory = new Map<string, typeof relevant>();
  for (const t of relevant) {
    const template = TEMPLATES_BY_ID.get(t.template_id);
    if (!template) continue;
    const list = byCategory.get(template.category_id) ?? [];
    list.push(t);
    byCategory.set(template.category_id, list);
  }

  const shownCategories = CATEGORIES.filter(
    (c) => byCategory.has(c.id) && (!activeCategory || c.id === activeCategory)
  );

  // journey (states + unlocks) + importance ranking, weighted by lifecycle stage
  const stageOf = (categoryId: string): Stage =>
    (CATEGORIES_BY_ID.get(categoryId)?.stage as Stage) ?? "operating";
  const journey = buildJourney(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant })),
    TEMPLATES_BY_ID,
    stageOf
  );
  const today = new Date().toISOString().slice(0, 10);
  const dueByTemplate = new Map(tasks.map((t) => [t.template_id, t.due_date]));
  const ranked = journey.nodes
    .map((n) => ({
      n,
      s: taskImportance(n, dueByTemplate.get(n.templateId) ?? null, today, stageOf(n.categoryId)),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const importantNow = ranked.slice(0, 4).map((x) => x.n);
  const nextId = journey.nextTemplateId;

  return (
    <div>
      <PageTitle eyebrow="מפת הפעולה" title="המשימות שלך" subtitle="לפי סדר החשיבות — מה לעשות עכשיו, ומה נפתח בהמשך" />

      {/* what's important now */}
      {!activeCategory && importantNow.length > 0 && (
        <FadeIn className="mb-6">
          <Card elevated className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
              <Zap className="h-4.5 w-4.5 text-brand-400" aria-hidden />
              מה חשוב עכשיו
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {importantNow.map((n) => {
                const cat = CATEGORIES_BY_ID.get(n.categoryId)!;
                return (
                  <Link
                    key={n.templateId}
                    href={`/tasks/${n.templateId}`}
                    className={`group flex items-center gap-3 rounded-xl border p-3 transition hover:border-brand-edge ${
                      n.templateId === nextId ? "border-brand-edge bg-brand-tint/40" : "border-edge-soft"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                      <CategoryIcon name={cat.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <PriorityBadge priority={n.priority} />
                        {n.unlocks.length > 0 && (
                          <span className="text-[11px] text-brand-strong">פותח {n.unlocks.length}</span>
                        )}
                      </div>
                    </div>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:text-brand-strong" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* category filter chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <FilterChip href="/tasks" active={!activeCategory} label="הכל" />
        {CATEGORIES.filter((c) => byCategory.has(c.id)).map((c) => (
          <FilterChip key={c.id} href={`/tasks?category=${c.id}`} active={activeCategory === c.id} label={c.title} />
        ))}
      </div>

      {activeCategory ? (
        <div className="flex flex-col gap-6">
          {shownCategories.map((category) => (
            <CategorySection key={category.id} category={category} list={byCategory.get(category.id)!} journey={journey} nextId={nextId} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {LIFE_STAGES.map((stage) => {
            const cats = shownCategories.filter((c) => c.stage === stage.id);
            if (cats.length === 0) return null;
            const stageTasks = cats.flatMap((c) => byCategory.get(c.id)!);
            const stageDone = stageTasks.filter((t) => t.status === "done").length;
            return (
              <FadeIn key={stage.id} whenInView>
                <div className="mb-3 border-b border-edge-soft pb-2">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-lg font-bold text-ink">{stage.title}</h2>
                    <span className="tnum text-xs font-medium text-ink-faint">{stageDone}/{stageTasks.length}</span>
                  </div>
                  <p className="text-xs text-ink-muted">{stage.subtitle}</p>
                </div>
                <div className="flex flex-col gap-6">
                  {cats.map((category) => (
                    <CategorySection key={category.id} category={category} list={byCategory.get(category.id)!} journey={journey} nextId={nextId} />
                  ))}
                </div>
              </FadeIn>
            );
          })}
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

const orderRank = (t: BusinessTask, node: JourneyNode | undefined) =>
  t.status === "done" ? 3 : node?.state === "locked" ? 2 : node?.state === "next" ? 0 : 1;

function CategorySection({
  category,
  list,
  journey,
  nextId,
}: {
  category: Category;
  list: BusinessTask[];
  journey: Journey;
  nextId: string | null;
}) {
  const doneCount = list.filter((t) => t.status === "done").length;
  const sorted = [...list].sort((a, b) => {
    const ra = orderRank(a, journey.byId.get(a.template_id));
    const rb = orderRank(b, journey.byId.get(b.template_id));
    if (ra !== rb) return ra - rb;
    return (TEMPLATES_BY_ID.get(a.template_id)!.sort_order ?? 0) - (TEMPLATES_BY_ID.get(b.template_id)!.sort_order ?? 0);
  });
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-brand-strong">
          <CategoryIcon name={category.icon} className="h-4 w-4" />
        </div>
        <h3 className="font-bold text-ink">{category.title}</h3>
        <span className="tnum mr-auto text-xs font-medium text-ink-faint">{doneCount}/{list.length}</span>
      </div>
      <Card className="divide-y divide-edge-soft">
        {sorted.map((task) => {
          const template = TEMPLATES_BY_ID.get(task.template_id)!;
          const node = journey.byId.get(task.template_id);
          return (
            <TaskRow
              key={task.id}
              templateId={task.template_id}
              title={template.title}
              priority={template.priority}
              status={task.status}
              dueDate={task.due_date}
              waitingFor={task.waiting_for}
              followUpDate={task.follow_up_date}
              state={node?.state}
              blockedBy={node?.blockedBy}
              unlocksCount={node?.unlocks.length ?? 0}
              isNext={task.template_id === nextId}
            />
          );
        })}
      </Card>
    </section>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-card text-ink-soft ring-1 ring-edge hover:bg-surface"
      }`}
    >
      {label}
    </Link>
  );
}
