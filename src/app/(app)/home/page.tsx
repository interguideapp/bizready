import { todayInIsrael } from "@/lib/dates";
import { loadLiveTasks } from "@/lib/tasks-live";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import { positionOf } from "@/lib/content/milestones";
import {
  getContentChanges,
  requireBusiness,
  getDocuments,
  getMetrics,
  getProducts,
  getTaskEvents,
  getFiledPeriods,
} from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeScore } from "@/lib/rules-engine";
import { computeUpcomingObligations, filingsBlockedByDismissal } from "@/lib/compliance";
import { SEVERITY_LABEL, rankByExposure } from "@/lib/exposure";
import {
  CHANGE_LABEL,
  changeBannerText,
  isConsequential,
  relevantChanges,
} from "@/lib/content/changelog";
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
  const business = await requireBusiness();
  const today = new Date();
  const [tasks, filedPeriods, documents, products, events, metrics, contentChanges] = await Promise.all([
    loadLiveTasks(business),
    getFiledPeriods(business.id),
    getDocuments(business.id),
    getProducts(business.id),
    getTaskEvents(business.id, 40),
    getMetrics(business.id, `${today.getFullYear()}-01-01`),
    getContentChanges(),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const profile = computeProfileCompleteness(business, { products: products.length, documents: documents.length });
  const relevant = tasks.filter((t) => t.is_relevant);
  const doneCount = relevant.filter((t) => t.status === "done").length;
  const todayIso = todayInIsrael(today);

  const streak = computeStreak(events.map((e) => ({ kind: e.kind, created_at: e.created_at })));

  // journey + attention
  const journey = buildJourney(
    tasks.map((t) => ({
        template_id: t.template_id,
        status: t.status,
        is_relevant: t.is_relevant,
        dismissal: t.dismissal,
      })),
    TEMPLATES_BY_ID,
    stageOf
  );
  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
        template_id: t.template_id,
        status: t.status,
        is_relevant: t.is_relevant,
        dismissal: t.dismissal,
        completion_data: t.completion_data,
        due_date: t.due_date,
        // The filing ledger (030), so EVERY missed period can be named
        // rather than only the oldest one the stored date can reach.
        filed_periods: filedPeriods.get(t.template_id) ?? [],
      })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    today,
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );
  const lockedIds = new Set(journey.nodes.filter((n) => n.state === "locked").map((n) => n.templateId));
  const actionable = obligations.filter((o) => !(o.templateId != null && lockedIds.has(o.templateId)));

  // Overdue comes from exactly ONE place: the obligations engine. It applies the
  // real anchored statutory dates AND the prerequisite gate — you cannot be late
  // filing VAT before your VAT file exists. The previous ad-hoc count read the
  // stale due_date column with no gate, so a brand-new עוסק מורשה was shown a red
  // "יש חוב אחד באיחור" for an obligation that did not legally exist, while the
  // calendar simultaneously showed nothing due.
  const overdueCount = actionable.filter(
    (o) => o.basis === "statutory" && o.daysUntil < 0
  ).length;
  const dueByTemplate = new Map(tasks.map((t) => [t.template_id, t.due_date]));
  const attention = computeAttention(
    actionable.map((o) => ({ templateId: o.templateId, title: o.title, dueDate: o.dueDate, daysUntil: o.daysUntil, basis: o.basis, periodLabel: o.periodLabel })),
    journey.nodes, dueByTemplate, todayIso, stageOf
  );
  // Ranked by consequence, not by date. The old ordering put whatever was
  // nearest first, so a harmless task due today outranked a VAT filing that
  // had been accruing a penalty for a week.
  const ranked = rankByExposure(actionable).slice(0, 4);
  const exposures = ranked.map((e) => ({
    title: e.title,
    href: e.templateId ? `/tasks/${e.templateId}?from=home` : "/calendar",
    dueLabel:
      e.daysUntil < 0
        ? `באיחור ${-e.daysUntil} ימים`
        : e.daysUntil === 0
          ? "היום"
          : `בעוד ${e.daysUntil} ימים`,
    severityLabel: SEVERITY_LABEL[e.severity],
    consequence: e.consequence,
    overdue: e.daysUntil < 0,
  }));

  // Targeted to the templates actually in this plan — including completed
  // ones, because a rule change on something already filed is often MORE
  // urgent than on something outstanding: the filing may need revisiting.
  const planTemplateIds = new Set(
    tasks.filter((t) => t.is_relevant).map((t) => t.template_id)
  );
  const ruleChangeList = relevantChanges(
    contentChanges.entries,
    planTemplateIds,
    (id) => TEMPLATES_BY_ID.get(id)?.title,
    contentChanges.readIds
  ).slice(0, 3);
  const ruleChanges = ruleChangeList.map((c) => ({
    id: c.id,
    title: c.title,
    href: c.href,
    summary: c.summary,
    kindLabel: CHANGE_LABEL[c.change_kind],
    sourceUrl: c.source_url,
    effectiveFrom: c.effective_from,
    consequential: isConsequential(c.change_kind),
  }));

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
    ? { title: confidence.theOneThing.title, href: oneThingId && oneThingId !== "calendar" ? `/tasks/${oneThingId}?from=home` : "/calendar" }
    : null;

  // Waiting on someone else — named by the task's own milestone rather than by
  // free text the user typed into a dialog. "ממתין לגורם חיצוני" was true of
  // every one of these and useful for none.
  const waiting = tasks
    .filter((t) => t.is_relevant && t.status === "waiting")
    .map((t) => {
      const pos = positionOf({
        template_id: t.template_id,
        stage: t.stage,
        status: t.status,
      });
      return {
        title: TEMPLATES_BY_ID.get(t.template_id)?.title ?? t.template_id,
        // The chain wins when it knows where we are. A row from before this
        // feature has no stage, so anything the user typed back then is better
        // information than a guess, and is used instead.
        waitingFor: pos.resolvedFromStage
          ? pos.stage.label
          : (t.waiting_for ?? pos.stage.label),
        step: pos.step,
        total: pos.total,
        followUp: t.follow_up_date ? new Date(t.follow_up_date + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }) : null,
        href: `/tasks/${t.template_id}?from=home`,
      };
    })
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

  // profile completeness — the "what's missing to 100%" checklist, now on Home
  const completeness = {
    percent: profile.percent,
    missing: profile.checks.filter((c) => !c.done).map((c) => ({ label: c.label, href: c.href })),
  };

  // A statutory filing gated by a dismissal, not by unfinished work. The user
  // told us a prerequisite doesn't apply; we believed them and stopped computing
  // the dates that depend on it, so we owe them that fact plainly.
  const blockedFilings = filingsBlockedByDismissal(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      dismissal: t.dismissal,
      completion_data: t.completion_data,
        due_date: t.due_date,
        // The filing ledger (030), so EVERY missed period can be named
        // rather than only the oldest one the stored date can reach.
        filed_periods: filedPeriods.get(t.template_id) ?? [],
    })),
    TEMPLATES_BY_ID
  ).map((b) => ({
    title: TEMPLATES_BY_ID.get(b.templateId)?.title ?? b.templateId,
    blockedByTitle: TEMPLATES_BY_ID.get(b.blockedBy)?.title ?? b.blockedBy,
    href: `/tasks/${b.blockedBy}?from=home`,
  }));

  const data: HomeOSData = {
    name: firstName(business.name),
    confidence: { state: confidence.state, headline: confidence.headline, detail: confidence.detail },
    oneThing,
    waiting,
    quickWins,
    completeness,
    nextDeadline,
    blockedFilings,
    ruleChanges,
    ruleChangesBanner: changeBannerText(ruleChangeList),
    exposures,
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
