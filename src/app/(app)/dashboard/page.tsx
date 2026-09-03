import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getCosts,
  getDocuments,
  getProducts,
  getTaskEvents,
} from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { buildJourney } from "@/lib/journey";
import { computeAttention, type Stage } from "@/lib/priority";
import {
  computeBadges,
  computeStreak,
  computeWins,
  computeXp,
  levelFromXp,
} from "@/lib/gamification";
import { monthlyTotal } from "@/lib/costs";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";
import type { OnboardingAnswers } from "@/lib/types";

const STAGE_OF = new Map(CATEGORIES.map((c) => [c.id, c.stage]));
const stageOf = (categoryId: string): Stage => (STAGE_OF.get(categoryId) as Stage) ?? "operating";
const STAGES = [
  { id: "setup", title: "הקמה" },
  { id: "operating", title: "תפעול שוטף" },
  { id: "growth", title: "צמיחה" },
];

export default async function DashboardPage() {
  const business = (await getBusiness())!;
  const [tasks, products, documents, events, costs] = await Promise.all([
    getBusinessTasks(business.id),
    getProducts(business.id),
    getDocuments(business.id),
    getTaskEvents(business.id, 200),
    getCosts(business.id),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const scoreByCategory = new Map(score.byCategory.map((c) => [c.category_id, c]));
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

  // gamification
  const gamiTasks = tasks.map((t) => ({
    template_id: t.template_id,
    status: t.status,
    is_relevant: t.is_relevant,
    completed_at: t.completed_at,
  }));
  const xp = computeXp(gamiTasks, TEMPLATES_BY_ID);
  const level = levelFromXp(xp);
  const streak = computeStreak(events.map((e) => ({ kind: e.kind, created_at: e.created_at })));
  const wins = computeWins(gamiTasks, TEMPLATES_BY_ID);
  const badges = computeBadges({
    tasks: gamiTasks,
    templates: TEMPLATES_BY_ID,
    stageOf: (cid) => STAGE_OF.get(cid) ?? "operating",
    profilePercent: profile.percent,
    documentsCount: documents.length,
    streak,
  }).filter((b) => b.earned);

  // journey graph (done/next/available/locked + unlocks)
  const journey = buildJourney(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant })),
    TEMPLATES_BY_ID,
    stageOf
  );

  // stage progress
  const stages = STAGES.map((s) => {
    const inStage = relevant.filter((t) => STAGE_OF.get(TEMPLATES_BY_ID.get(t.template_id)?.category_id ?? "") === s.id);
    return { id: s.id, title: s.title, done: inStage.filter((t) => t.status === "done").length, total: inStage.length };
  }).filter((s) => s.total > 0);

  // obligations
  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant, completion_data: t.completion_data })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );
  // unified attention: the single most pressing dated item + the most important next task
  const dueByTemplate = new Map(tasks.map((t) => [t.template_id, t.due_date]));
  const attention = computeAttention(
    obligations.map((o) => ({
      templateId: o.templateId,
      title: o.title,
      dueDate: o.dueDate,
      daysUntil: o.daysUntil,
      basis: o.basis,
      periodLabel: o.periodLabel,
    })),
    journey.nodes,
    dueByTemplate,
    today,
    stageOf
  );
  const urgent = attention.urgent;
  const nextTpl = attention.nextTemplateId ? TEMPLATES_BY_ID.get(attention.nextTemplateId) : null;

  const data: DashboardData = {
    businessName: business.name,
    level,
    streak,
    scoreOverall: score.overall,
    categories: CATEGORIES.filter((c) => scoreByCategory.has(c.id)).map((c) => {
      const s = scoreByCategory.get(c.id)!;
      return { id: c.id, title: c.title, icon: c.icon, score: s.score, done: s.done, total: s.total };
    }),
    stages,
    doneCount,
    totalCount: relevant.length,
    overdueCount,
    profilePercent: profile.percent,
    monthlyCost: costs.length > 0 ? monthlyTotal(costs) : null,
    nextAction: nextTpl
      ? { templateId: nextTpl.id, title: nextTpl.title, icon: CATEGORIES_BY_ID.get(nextTpl.category_id)?.icon ?? "Circle", priority: nextTpl.priority }
      : null,
    recentWins: wins.slice(0, 6).map((w) => ({
      templateId: w.templateId,
      title: w.title,
      icon: CATEGORIES_BY_ID.get(w.categoryId)?.icon ?? "Circle",
      date: w.date,
    })),
    earnedBadges: badges.map((b) => ({ id: b.id, title: b.title, icon: b.icon })),
    urgent: urgent
      ? { templateId: urgent.templateId ?? "calendar", title: urgent.title, dueDate: urgent.dueDate, daysUntil: urgent.daysUntil, periodLabel: urgent.periodLabel }
      : null,
    upcoming: obligations.slice(0, 4).map((o) => ({
      templateId: o.templateId ?? "calendar",
      title: o.title,
      dueDate: o.dueDate,
      basis: o.basis === "statutory" ? ("statutory" as const) : ("recommended" as const),
    })),
  };

  return <DashboardView data={data} />;
}
