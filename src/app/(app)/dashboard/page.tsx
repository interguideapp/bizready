import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getDocuments,
  getProducts,
} from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore, nextSteps } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";
import type { OnboardingAnswers } from "@/lib/types";

export default async function DashboardPage() {
  const business = (await getBusiness())!;
  const [tasks, products, documents] = await Promise.all([
    getBusinessTasks(business.id),
    getProducts(business.id),
    getDocuments(business.id),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
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
      t.due_date < today &&
      isStatutoryFiling(t.template_id)
  ).length;

  const scoreByCategory = new Map(score.byCategory.map((c) => [c.category_id, c]));

  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      completion_data: t.completion_data,
    })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    {
      entityType: business.entity_type,
      vatFrequency: answers?.vat_frequency,
      hasAccountant: Boolean(business.accountant_name),
    }
  );
  const urgent = obligations[0] ?? null;

  const data: DashboardData = {
    businessName: business.name,
    scoreOverall: score.overall,
    categories: CATEGORIES.filter((c) => scoreByCategory.has(c.id)).map((c) => {
      const s = scoreByCategory.get(c.id)!;
      return { id: c.id, title: c.title, icon: c.icon, score: s.score, done: s.done, total: s.total };
    }),
    doneCount,
    totalCount: relevant.length,
    overdueCount,
    profilePercent: profile.percent,
    steps: stepIds.map((id) => {
      const template = TEMPLATES_BY_ID.get(id)!;
      const task = taskByTemplate.get(id)!;
      const cat = CATEGORIES_BY_ID.get(template.category_id)!;
      return {
        templateId: id,
        title: template.title,
        icon: cat.icon,
        priority: template.priority,
        dueDate: task.due_date,
        basis: isStatutoryFiling(id) ? ("statutory" as const) : ("recommended" as const),
      };
    }),
    upcoming: obligations.slice(0, 4).map((o) => ({
      templateId: o.templateId ?? "calendar",
      title: o.title,
      dueDate: o.dueDate,
      basis: o.basis === "statutory" ? ("statutory" as const) : ("recommended" as const),
    })),
    urgent: urgent
      ? {
          templateId: urgent.templateId ?? "calendar",
          title: urgent.title,
          dueDate: urgent.dueDate,
          daysUntil: urgent.daysUntil,
          periodLabel: urgent.periodLabel,
        }
      : null,
  };

  return <DashboardView data={data} />;
}
