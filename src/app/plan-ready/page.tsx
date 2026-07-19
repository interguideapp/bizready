import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { ScoreRing } from "@/components/score-ring";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks } from "@/lib/data";
import { computeScore } from "@/lib/rules-engine";

export default async function PlanReadyPage() {
  const business = await getBusiness();
  if (!business?.onboarding_completed_at) redirect("/onboarding");

  const tasks = await getBusinessTasks(business.id);
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const activeTasks = tasks.filter((t) => t.is_relevant);
  const byCategory = new Map<string, number>();
  for (const t of activeTasks) {
    const template = TEMPLATES_BY_ID.get(t.template_id);
    if (!template) continue;
    byCategory.set(template.category_id, (byCategory.get(template.category_id) ?? 0) + 1);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold text-brand-600">התכנית של {business.name} מוכנה 🎉</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          זה המצב — ומכאן רק עולים
        </h1>

        <div className="mt-8 flex justify-center">
          <ScoreRing score={score.overall} size={180} />
        </div>

        <p className="mx-auto mt-6 max-w-sm leading-relaxed text-slate-600">
          בנינו לכם תכנית אישית עם{" "}
          <b className="text-slate-900">{activeTasks.length} משימות</b> ב-
          {byCategory.size} תחומים — כל אחת עם הסבר, צעדים וקישורים רשמיים.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-2.5 text-right">
          {CATEGORIES.filter((c) => byCategory.has(c.id)).map((c, i) => (
            <div
              key={c.id}
              className="animate-fade-up flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <CategoryIcon name={c.icon} className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{c.title}</p>
                <p className="text-xs text-slate-500">{byCategory.get(c.id)} משימות</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
        >
          קדימה לעבודה
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
