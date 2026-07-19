import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { TaskRow } from "@/components/task-row";
import { Card, Disclaimer, PageTitle } from "@/components/ui";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks } from "@/lib/data";

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

  return (
    <div>
      <PageTitle
        title="המשימות שלך"
        subtitle="כל מה שהעסק צריך — לפי תחומים, עם סימון בקליק"
      />

      {/* category filter chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <FilterChip href="/tasks" active={!activeCategory} label="הכל" />
        {CATEGORIES.filter((c) => byCategory.has(c.id)).map((c) => (
          <FilterChip
            key={c.id}
            href={`/tasks?category=${c.id}`}
            active={activeCategory === c.id}
            label={c.title}
          />
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {shownCategories.map((category) => {
          const list = byCategory.get(category.id)!;
          const doneCount = list.filter((t) => t.status === "done").length;
          const sorted = [...list].sort((a, b) => {
            const ta = TEMPLATES_BY_ID.get(a.template_id)!;
            const tb = TEMPLATES_BY_ID.get(b.template_id)!;
            return ta.sort_order - tb.sort_order;
          });
          return (
            <section key={category.id}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <CategoryIcon name={category.icon} className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">{category.title}</h2>
                <span className="mr-auto text-xs font-medium text-slate-400">
                  {doneCount}/{list.length}
                </span>
              </div>
              <Card className="divide-y divide-slate-100">
                {sorted.map((task) => {
                  const template = TEMPLATES_BY_ID.get(task.template_id)!;
                  return (
                    <TaskRow
                      key={task.id}
                      taskId={task.id}
                      templateId={task.template_id}
                      title={template.title}
                      priority={template.priority}
                      status={task.status}
                      dueDate={task.due_date}
                    />
                  );
                })}
              </Card>
            </section>
          );
        })}
      </div>

      <Disclaimer />
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
