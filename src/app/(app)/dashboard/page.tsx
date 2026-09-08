import { CATEGORIES, CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getCosts,
  getDocuments,
  getMetrics,
  getProducts,
  getTaskEvents,
} from "@/lib/data";
import { computeSetAside } from "@/lib/finance/setaside";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { buildJourney } from "@/lib/journey";
import { computeAttention, taskImportance, type Stage } from "@/lib/priority";
import { computeConfidence } from "@/lib/confidence";
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

function daysPhrase(d: number) {
  if (d < 0) return "עבר המועד";
  if (d === 0) return "היום";
  if (d === 1) return "מחר";
  return `בעוד ${d} ימים`;
}

export default async function DashboardPage() {
  const business = (await getBusiness())!;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [tasks, products, documents, events, costs, metrics] = await Promise.all([
    getBusinessTasks(business.id),
    getProducts(business.id),
    getDocuments(business.id),
    getTaskEvents(business.id, 200),
    getCosts(business.id),
    getMetrics(business.id, yearStart),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
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
  const allBadges = computeBadges({
    tasks: gamiTasks,
    templates: TEMPLATES_BY_ID,
    stageOf: (cid) => STAGE_OF.get(cid) ?? "operating",
    profilePercent: profile.percent,
    documentsCount: documents.length,
    streak,
  });
  const badges = allBadges.filter((b) => b.earned);

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
  // One truth: the dependency graph gates what's shown. An obligation whose task
  // is still locked (prerequisites not done) is not something you can act on yet,
  // so it never appears as "pressing" or as an upcoming deadline on the dashboard.
  const lockedIds = new Set(
    journey.nodes.filter((n) => n.state === "locked").map((n) => n.templateId)
  );
  const actionableObligations = obligations.filter(
    (o) => !(o.templateId != null && lockedIds.has(o.templateId))
  );

  // unified attention: the single most pressing dated item + the most important next task
  const dueByTemplate = new Map(tasks.map((t) => [t.template_id, t.due_date]));
  const attention = computeAttention(
    actionableObligations.map((o) => ({
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

  // confidence layer — the plain-language "am I OK?" status
  const remainingCritical = relevant.filter(
    (t) => t.status !== "done" && TEMPLATES_BY_ID.get(t.template_id)?.priority === "critical"
  ).length;
  const confidence = computeConfidence({
    overdueStatutory: overdueCount,
    urgent: urgent ? { templateId: urgent.templateId, title: urgent.title, daysUntil: urgent.daysUntil } : null,
    next: nextTpl ? { templateId: nextTpl.id, title: nextTpl.title } : null,
    remainingCritical,
  });
  const oneThingId = confidence.theOneThing?.templateId ?? null;
  const oneThingTpl = oneThingId ? TEMPLATES_BY_ID.get(oneThingId) : null;
  let oneThingMeta = "";
  if (confidence.state === "at_risk") oneThingMeta = "כדאי לטפל היום";
  else if (urgent && oneThingId === urgent.templateId) oneThingMeta = daysPhrase(urgent.daysUntil);
  else if (oneThingTpl) oneThingMeta = [oneThingTpl.est_cost, oneThingTpl.est_time].filter(Boolean).join(" · ");

  // "this week" — actionable dated items due within a week
  const week = actionableObligations
    .filter((o) => o.daysUntil >= 0 && o.daysUntil <= 7)
    .slice(0, 3)
    .map((o) => ({ templateId: o.templateId ?? "calendar", title: o.title, daysUntil: o.daysUntil }));

  // Split the forward work into the critical PATH (the registration/tax spine,
  // shown in stage + dependency order even when a step is still locked, so the
  // true next direction is always visible) and "על הדרך" — available side tasks
  // you can knock out anytime without blocking progress.
  const STAGE_ORDER: Record<string, number> = { setup: 0, operating: 1, growth: 2 };
  const catIcon = (id: string) => CATEGORIES_BY_ID.get(id)?.icon ?? "Circle";
  const catTitle = (id: string) => CATEGORIES_BY_ID.get(id)?.title ?? "";
  const onPath = (n: (typeof journey.nodes)[number]) => {
    const stg = stageOf(n.categoryId);
    return (
      stg === "setup" ||
      n.categoryId === "tax" ||
      n.categoryId === "employment" ||
      isStatutoryFiling(n.templateId) ||
      (n.categoryId === "finance" && n.priority === "critical")
    );
  };
  const notDone = journey.nodes.filter((n) => n.state !== "done" && n.templateId !== oneThingId);
  const toStep = (n: (typeof journey.nodes)[number]) => ({
    templateId: n.templateId,
    title: n.title,
    icon: catIcon(n.categoryId),
    categoryTitle: catTitle(n.categoryId),
    locked: n.state === "locked",
    blockedByTitle: n.blockedBy[0] ?? null,
  });
  const pathSteps = notDone
    .filter(onPath)
    .sort(
      (a, b) =>
        (STAGE_ORDER[stageOf(a.categoryId)] ?? 1) - (STAGE_ORDER[stageOf(b.categoryId)] ?? 1) ||
        (TEMPLATES_BY_ID.get(a.templateId)?.sort_order ?? 0) - (TEMPLATES_BY_ID.get(b.templateId)?.sort_order ?? 0)
    )
    .slice(0, 4)
    .map(toStep);
  const asideSteps = notDone
    .filter((n) => !onPath(n) && n.state !== "locked")
    .map((n) => ({ n, s: taskImportance(n, dueByTemplate.get(n.templateId) ?? null, today, stageOf(n.categoryId)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => toStep(x.n));

  // money signal — income logged (or synced) this year drives the set-aside hint
  const REVENUE_METRICS = new Set(["revenue", "manual_revenue"]);
  const thisMonthPrefix = new Date().toISOString().slice(0, 7); // yyyy-mm
  let revenueYtd = 0;
  let monthRevenue = 0;
  for (const m of metrics) {
    if (!REVENUE_METRICS.has(m.metric)) continue;
    revenueYtd += m.value;
    if (m.metric_date.startsWith(thisMonthPrefix)) monthRevenue += m.value;
  }
  const setAside = computeSetAside(revenueYtd);
  // corporate tax isn't a flat set-aside % of turnover, so the rule of thumb is
  // shown only for the individual structures.
  const showSetAside = business.entity_type !== "company";
  const money = {
    hasIncome: revenueYtd > 0,
    monthRevenue,
    setAsideLow: setAside.low,
    setAsideHigh: setAside.high,
    showSetAside,
  };

  const data: DashboardData = {
    businessName: business.name,
    confidence: { state: confidence.state, headline: confidence.headline, detail: confidence.detail },
    oneThing: confidence.theOneThing
      ? { templateId: confidence.theOneThing.templateId, title: confidence.theOneThing.title, meta: oneThingMeta }
      : null,
    level: {
      level: level.level,
      title: level.title,
      progress: level.progress,
      nextGap: Math.max(0, (level.nextAt ?? 0) - level.xp),
      nextTitle: level.nextTitle,
    },
    scoreOverall: score.overall,
    streak,
    week,
    doneCount,
    totalCount: relevant.length,
    overdueCount,
    profilePercent: profile.percent,
    monthlyCost: costs.length > 0 ? monthlyTotal(costs) : null,
    money,
    stages,
    pathSteps,
    asideSteps,
    recentWins: wins.slice(0, 6).map((w) => ({ templateId: w.templateId, title: w.title })),
    earnedBadges: badges.map((b) => ({ id: b.id, title: b.title, icon: b.icon })),
    badgeTotal: allBadges.length,
  };

  return <DashboardView data={data} />;
}
