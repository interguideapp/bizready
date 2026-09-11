import Link from "next/link";
import { AlertTriangle, CalendarClock, Flame, Gauge, Info } from "lucide-react";
import { Card, FadeIn, PageTitle } from "@/components/ui";
import { CostsManager } from "@/components/costs-manager";
import { TrophyWall } from "@/components/insights/trophy-wall";
import { FinancePanels } from "@/components/finance/finance-panels";
import { IncomeLogger } from "@/components/finance/income-logger";
import { buildIncomeMonths } from "@/lib/finance/income";
import type { MonthPoint } from "@/components/revenue-chart";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import {
  requireBusiness,
  getBusinessTasks,
  getCosts,
  getDocuments,
  getMetrics,
  getProducts,
  getTaskEvents,
} from "@/lib/data";
import { computeScore } from "@/lib/rules-engine";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeUpcomingObligations } from "@/lib/compliance";
import { SEVERITY_LABEL, rankByExposure } from "@/lib/exposure";
import {
  computeBadges,
  computeStreak,
  computeWins,
} from "@/lib/gamification";
import { monthlyTotal } from "@/lib/costs";
import { YEARLY_FIGURES, type OnboardingAnswers } from "@/lib/types";

const STAGE_OF = new Map(CATEGORIES.map((c) => [c.id, c.stage]));

export default async function InsightsPage() {
  const business = await requireBusiness();
  const [tasks, documents, costs, products, events] = await Promise.all([
    getBusinessTasks(business.id),
    getDocuments(business.id),
    getCosts(business.id),
    getProducts(business.id),
    getTaskEvents(business.id, 200),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const scoreByCat = new Map(score.byCategory.map((c) => [c.category_id, c]));
  const profile = computeProfileCompleteness(business, { products: products.length, documents: documents.length });

  const gamiTasks = tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant, completed_at: t.completed_at }));
  const streak = computeStreak(events.map((e) => ({ kind: e.kind, created_at: e.created_at })));
  const wins = computeWins(gamiTasks, TEMPLATES_BY_ID);
  const badges = computeBadges({
    tasks: gamiTasks,
    templates: TEMPLATES_BY_ID,
    stageOf: (cid) => STAGE_OF.get(cid) ?? "operating",
    profilePercent: profile.percent,
    documentsCount: documents.length,
    streak,
  });

  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
        template_id: t.template_id,
        status: t.status,
        is_relevant: t.is_relevant,
        dismissal: t.dismissal,
        completion_data: t.completion_data,
        due_date: t.due_date,
      })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );

  // WHAT THIS PAGE LEADS WITH.
  //
  // It led with the readiness score, and that number can sit at 95 while a
  // statutory filing is overdue: a task handed to the accountant counts as
  // "waiting" and earns half credit, so the score barely moves. A page called
  // תובנות that opens with a reassuring number while money is accruing against
  // you is not analysis, it is decoration — and it is the same false-comfort
  // shape the audit removed from the home screen (B10: the score is a
  // secondary progress metric, never the headline).
  //
  // Same engines as home, deliberately: one ranking of consequence in the
  // product, not one per page.
  const actionable = obligations.filter((o) => o.templateId !== null || o.kind === "document_expiry");
  const overdueStatutory = actionable.filter(
    (o) => o.basis === "statutory" && o.daysUntil < 0
  );
  const topExposures = rankByExposure(actionable)
    .filter((e) => e.daysUntil <= 30)
    .slice(0, 3);

  // Where the score is actually being lost, so the number is explainable
  // rather than just displayed. Ordered by how many tasks are outstanding,
  // which is what the user can act on.
  const weakest = [...score.byCategory]
    .filter((c) => c.total > c.done)
    .sort((a, b) => b.total - b.done - (a.total - a.done) || a.score - b.score)
    .slice(0, 3);

  // finance panels — appear once real revenue is synced from invoicing
  const now = new Date();
  const year = now.getFullYear();
  const metrics = await getMetrics(business.id, `${year - 1}-01-01`);
  // synced revenue (from an invoicing integration) and hand-logged income are
  // summed — the money picture works whether or not a tool is connected.
  const REVENUE_METRICS = new Set(["revenue", "manual_revenue"]);
  const revByMonth = new Map<string, number>();
  let hasSynced = false;
  for (const m of metrics) {
    if (!REVENUE_METRICS.has(m.metric)) continue;
    if (m.metric === "revenue" && m.value > 0) hasSynced = true;
    const dt = new Date(m.metric_date + "T00:00:00");
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    revByMonth.set(key, (revByMonth.get(key) ?? 0) + m.value);
  }
  const monthly: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.push({ year: dt.getFullYear(), month: dt.getMonth(), value: revByMonth.get(`${dt.getFullYear()}-${dt.getMonth()}`) ?? 0 });
  }
  const revenueYtd = metrics
    .filter((m) => REVENUE_METRICS.has(m.metric) && m.metric_date.startsWith(String(year)))
    .reduce((s, m) => s + m.value, 0);
  const hasFinance = revenueYtd > 0;

  // seed the manual income logger from what's already been entered
  const manualByKey: Record<string, number> = {};
  for (const m of metrics) {
    if (m.metric !== "manual_revenue") continue;
    manualByKey[m.metric_date.slice(0, 7)] = m.value;
  }
  const incomeMonths = buildIncomeMonths(manualByKey, 6, now);
  const financeData = hasFinance
    ? {
        monthly,
        entityType: business.entity_type,
        ceiling: YEARLY_FIGURES.osekPaturCeiling,
        revenueYtd,
        latestMonthRevenue: revByMonth.get(`${now.getFullYear()}-${now.getMonth()}`) ?? 0,
        monthlyCosts: costs.length ? monthlyTotal(costs) : 0,
        nextPayments: obligations.slice(0, 3).map((o) => ({
          title: o.title,
          date: new Date(o.dueDate + "T00:00:00").toLocaleDateString("he-IL"),
        })),
      }
    : null;

  return (
    <div>
      <PageTitle eyebrow="מודיעין עסקי" title="תובנות" subtitle="ההתקדמות, ההישגים, העלויות והמועדים — במבט אחד" />

      {/* Consequence before progress. */}
      {overdueStatutory.length > 0 && (
        <div className="mb-5 rounded-2xl border border-status-overdue/40 bg-status-overdue/5 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-section text-status-overdue">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
            {overdueStatutory.length === 1
              ? "חובה חוקית אחת עברה את המועד"
              : `${overdueStatutory.length} חובות חוקיות עברו את המועד`}
          </h2>
          <p className="text-xs leading-relaxed text-ink-soft">
            כל עוד זה המצב, הציון למטה לא מספר את כל הסיפור — איחור צובר ריבית
            והצמדה מהיום הראשון, בלי קשר לכמה משימות אחרות הושלמו.
          </p>
          <Link
            href="/calendar"
            className="mt-2 inline-block text-xs font-semibold text-status-overdue hover:underline"
          >
            ללוח החובות ←
          </Link>
        </div>
      )}

      {topExposures.length > 0 && (
        <FadeIn>
          <Card className="mb-5 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
              <Flame className="h-4.5 w-4.5 text-brand-400" aria-hidden />
              מה הכי כדאי לטפל בו
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-ink-muted">
              מדורג לפי מה שקורה אם מתעלמים — לא לפי מה שהתאריך שלו הקרוב ביותר.
            </p>
            <ul className="flex flex-col divide-y divide-edge-soft">
              {topExposures.map((e) => (
                <li key={e.obligationId} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={e.templateId ? `/tasks/${e.templateId}?from=insights` : "/calendar"}
                      className="truncate text-sm font-semibold text-ink hover:text-brand-strong"
                    >
                      {e.title}
                    </Link>
                    <span
                      className={`tnum shrink-0 text-xs font-medium ${
                        e.daysUntil < 0 ? "text-status-overdue" : "text-ink-muted"
                      }`}
                    >
                      {e.daysUntil < 0
                        ? `באיחור ${-e.daysUntil} ימים`
                        : e.daysUntil === 0
                          ? "היום"
                          : `בעוד ${e.daysUntil} ימים`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                    <span className="font-medium text-ink-soft">{SEVERITY_LABEL[e.severity]}</span>
                    {" · "}
                    {e.consequence}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      )}

      {/* Say where the numbers come from instead of showing empty bars and ₪0.
          The finance half needs revenue, and revenue arrives either from an
          invoicing connection or from logging it by hand. */}
      {!hasFinance && (
        <Card className="mb-5 p-4">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
            <span>
              החלק הכספי כאן מתמלא ברגע שיש מחזור — או מחיבור לתוכנת החשבוניות,
              או מרישום הכנסה ידני בבית. עד אז מוצגת רק ההתקדמות במשימות.
            </span>
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
        {/* readiness breakdown */}
        <FadeIn>
          <Card className="h-full p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-section text-ink"><Gauge className="h-4.5 w-4.5 text-brand-400" aria-hidden />היערכות לפי תחום</h2>
              <span className="tnum text-sm text-ink-muted">ציון כולל <b className="text-ink">{score.overall}</b></span>
            </div>
            {/* A bare number invites the reader to treat it as a verdict. This
                says what is behind it, which is the only part they can act on. */}
            {weakest.length > 0 && (
              <p className="mb-3 text-xs leading-relaxed text-ink-muted">
                מה שמוריד אותו עכשיו:{" "}
                {weakest.map((c, i) => (
                  <span key={c.category_id}>
                    {i > 0 && ", "}
                    <b className="font-medium text-ink-soft">
                      {CATEGORIES.find((x) => x.id === c.category_id)?.title ?? c.category_id}
                    </b>{" "}
                    ({c.total - c.done} שנותרו)
                  </span>
                ))}
                .
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {CATEGORIES.filter((c) => scoreByCat.has(c.id)).map((c) => {
                const s = scoreByCat.get(c.id)!;
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink-soft">{c.title}</span>
                      <span className="tnum text-xs text-ink-muted">{s.done}/{s.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </FadeIn>

        {/* trophy wall */}
        <FadeIn>
          <TrophyWall badges={badges} wins={wins} />
        </FadeIn>
        </div>

        {/* manual income — makes the money picture work without an integration */}
        <FadeIn><IncomeLogger months={incomeMonths} synced={hasSynced} /></FadeIn>

        {/* finance panels (appear once there's any revenue, synced or logged) */}
        {financeData && <FadeIn><FinancePanels d={financeData} /></FadeIn>}

        {/* costs */}
        <FadeIn><CostsManager costs={costs} /></FadeIn>

        {/* compliance timeline */}
        {obligations.length > 0 && (
          <FadeIn>
            <Card className="h-full p-5">
              <h2 className="mb-3 flex items-center gap-2 text-section text-ink"><CalendarClock className="h-4.5 w-4.5 text-brand-400" aria-hidden />מה מתי — ציר המועדים</h2>
              <div className="relative ps-4">
                <span className="absolute bottom-1 right-[7px] top-1 w-px bg-edge" aria-hidden />
                <div className="flex flex-col gap-3">
                  {obligations.slice(0, 8).map((o) => (
                    <div key={o.id} className="relative flex items-center gap-3">
                      <span className={`absolute right-[-4px] h-2.5 w-2.5 rounded-full led ${o.daysUntil < 0 ? "text-status-overdue bg-status-overdue" : o.daysUntil <= 7 ? "text-status-progress bg-status-progress" : "text-brand-400 bg-brand-400"}`} />
                      <div className="ms-4 flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-ink-soft">{o.title}{o.periodLabel && <span className="text-ink-faint"> · {o.periodLabel}</span>}</span>
                        <span className="tnum shrink-0 text-xs font-semibold text-ink">{new Date(o.dueDate + "T00:00:00").toLocaleDateString("he-IL")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* It used to slice to 8 and say nothing, so obligations nine
                  onward simply were not there. */}
              <Link href="/calendar" className="mt-3 inline-block text-xs font-medium text-brand-strong hover:opacity-80">
                {obligations.length > 8
                  ? `עוד ${obligations.length - 8} בלוח החובות המלא ←`
                  : "ללוח החובות המלא ←"}
              </Link>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
