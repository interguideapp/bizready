import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getDocuments,
  getMetrics,
  getProducts,
  getTaskEvents,
} from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { buildJourney } from "@/lib/journey";
import { computeAttention, type Stage } from "@/lib/priority";
import { computeConfidence } from "@/lib/confidence";
import { computeStreak } from "@/lib/gamification";
import { computeSetAside } from "@/lib/finance/setaside";
import { buildQuickWins, estMinutes, isQuickTask } from "@/lib/home";
import { HomeOS, type HomeOSData } from "@/components/home/home-os";
import { YEARLY_FIGURES, type OnboardingAnswers } from "@/lib/types";

const STAGE_OF = new Map(CATEGORIES.map((c) => [c.id, c.stage]));
const stageOf = (categoryId: string): Stage => (STAGE_OF.get(categoryId) as Stage) ?? "operating";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Short relative "how long ago" in Hebrew. */
function agoPhrase(iso: string, now: Date): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} ד׳`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `לפני ${hrs} ש׳`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

const EVENT_VERB: Record<string, { verb: string; icon: string }> = {
  completed: { verb: "השלמתם", icon: "CheckCircle2" },
  status_change: { verb: "עדכנתם", icon: "Clock3" },
  reopened: { verb: "פתחתם מחדש", icon: "Clock3" },
  deadline_set: { verb: "קבעתם מועד ל", icon: "CalendarClock" },
};

export default async function HomePage() {
  const business = (await getBusiness())!;
  const today = new Date();
  const [tasks, documents, products, events, metrics] = await Promise.all([
    getBusinessTasks(business.id),
    getDocuments(business.id),
    getProducts(business.id),
    getTaskEvents(business.id, 40),
    getMetrics(business.id, `${today.getFullYear()}-01-01`),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const profile = computeProfileCompleteness(business, { products: products.length, documents: documents.length });
  const relevant = tasks.filter((t) => t.is_relevant);
  const doneCount = relevant.filter((t) => t.status === "done").length;
  const todayIso = today.toISOString().slice(0, 10);

  const overdueCount = relevant.filter(
    (t) =>
      (t.status === "todo" || t.status === "in_progress") &&
      t.due_date && t.due_date < todayIso && isStatutoryFiling(t.template_id)
  ).length;

  const streak = computeStreak(events.map((e) => ({ kind: e.kind, created_at: e.created_at })));

  // journey + attention
  const journey = buildJourney(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant })),
    TEMPLATES_BY_ID,
    stageOf
  );
  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant, completion_data: t.completion_data })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    today,
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );
  const lockedIds = new Set(journey.nodes.filter((n) => n.state === "locked").map((n) => n.templateId));
  const actionable = obligations.filter((o) => !(o.templateId != null && lockedIds.has(o.templateId)));
  const dueByTemplate = new Map(tasks.map((t) => [t.template_id, t.due_date]));
  const attention = computeAttention(
    actionable.map((o) => ({ templateId: o.templateId, title: o.title, dueDate: o.dueDate, daysUntil: o.daysUntil, basis: o.basis, periodLabel: o.periodLabel })),
    journey.nodes, dueByTemplate, todayIso, stageOf
  );
  const urgent = attention.urgent;
  const nextTpl = attention.nextTemplateId ? TEMPLATES_BY_ID.get(attention.nextTemplateId) : null;

  // money
  const REVENUE_METRICS = new Set(["revenue", "manual_revenue"]);
  const monthPrefix = todayIso.slice(0, 7);
  let revenueYtd = 0, monthRevenue = 0, loggedIncomeThisMonth = false;
  for (const m of metrics) {
    if (!REVENUE_METRICS.has(m.metric)) continue;
    revenueYtd += m.value;
    if (m.metric_date.startsWith(monthPrefix)) { monthRevenue += m.value; if (m.value > 0) loggedIncomeThisMonth = true; }
  }
  const setAside = computeSetAside(revenueYtd);
  const showSetAside = business.entity_type !== "company";
  const hasIncome = revenueYtd > 0;

  // confidence (with ceiling awareness for patur)
  const remainingCritical = relevant.filter(
    (t) => t.status !== "done" && TEMPLATES_BY_ID.get(t.template_id)?.priority === "critical"
  ).length;
  const ceilingPct = business.entity_type === "osek_patur" && revenueYtd > 0
    ? (revenueYtd / YEARLY_FIGURES.osekPaturCeiling) * 100 : undefined;
  const confidence = computeConfidence({
    overdueStatutory: overdueCount,
    urgent: urgent ? { templateId: urgent.templateId, title: urgent.title, daysUntil: urgent.daysUntil } : null,
    next: nextTpl ? { templateId: nextTpl.id, title: nextTpl.title } : null,
    remainingCritical,
    ceilingPct,
    ceilingTaskId: journey.nodes.some((n) => n.templateId === "patur-ceiling-watch") ? "patur-ceiling-watch" : null,
  });
  const oneThingId = confidence.theOneThing?.templateId ?? null;
  const oneThing = confidence.theOneThing
    ? { title: confidence.theOneThing.title, href: oneThingId && oneThingId !== "calendar" ? `/tasks/${oneThingId}` : "/calendar" }
    : null;

  // waiting on a third party (handed off, awaiting an authority/approval)
  const waiting = tasks
    .filter((t) => t.is_relevant && t.status === "waiting")
    .map((t) => ({
      title: TEMPLATES_BY_ID.get(t.template_id)?.title ?? t.template_id,
      waitingFor: t.waiting_for ?? null,
      followUp: t.follow_up_date ? new Date(t.follow_up_date + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }) : null,
      href: `/tasks/${t.template_id}`,
    }))
    .slice(0, 4);

  // quick wins: short, available, not-done tasks + data-completeness actions
  const shortTasks = journey.nodes
    .filter((n) => (n.state === "available" || n.state === "next"))
    .map((n) => ({ n, min: estMinutes(TEMPLATES_BY_ID.get(n.templateId)?.est_time) }))
    .filter((x) => isQuickTask(x.min) && x.n.templateId !== oneThingId)
    .sort((a, b) => (a.min ?? 99) - (b.min ?? 99))
    .slice(0, 3)
    .map((x) => ({ templateId: x.n.templateId, title: x.n.title, minutes: x.min ?? 10 }));
  const quickWins = buildQuickWins({
    hasIncome, profilePercent: profile.percent, documentsCount: documents.length,
    productsCount: products.length, loggedIncomeThisMonth, shortTasks,
  });

  // next statutory deadline
  const nextDeadline = actionable.length > 0
    ? { title: actionable[0].title, date: new Date(actionable[0].dueDate + "T00:00:00").toLocaleDateString("he-IL"), daysUntil: actionable[0].daysUntil }
    : null;

  // recent activity — what you updated/uploaded
  const activity = events
    .filter((e) => EVENT_VERB[e.kind])
    .slice(0, 5)
    .map((e) => {
      const meta = EVENT_VERB[e.kind];
      const title = e.template_id ? TEMPLATES_BY_ID.get(e.template_id)?.title ?? "" : "";
      return { text: `${meta.verb} ${title}`.trim(), when: agoPhrase(e.created_at, today), icon: meta.icon };
    });

  const data: HomeOSData = {
    name: firstName(business.name),
    confidence: { state: confidence.state, headline: confidence.headline, detail: confidence.detail },
    oneThing,
    waiting,
    quickWins,
    nextDeadline,
    tiles: {
      readiness: score.overall,
      money: { hasIncome, setAsideLow: setAside.low, setAsideHigh: setAside.high, monthRevenue, showSetAside },
      streak,
      docsCount: documents.length,
      done: doneCount,
      total: relevant.length,
      profilePercent: profile.percent,
    },
    activity,
  };

  return <HomeOS data={data} />;
}
