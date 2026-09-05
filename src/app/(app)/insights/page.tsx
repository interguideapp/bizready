import Link from "next/link";
import { CalendarClock, Gauge } from "lucide-react";
import { Card, FadeIn, PageTitle } from "@/components/ui";
import { CostsManager } from "@/components/costs-manager";
import { TrophyWall } from "@/components/insights/trophy-wall";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getCosts,
  getDocuments,
  getProducts,
  getTaskEvents,
} from "@/lib/data";
import { computeScore } from "@/lib/rules-engine";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { computeUpcomingObligations } from "@/lib/compliance";
import {
  computeBadges,
  computeStreak,
  computeWins,
} from "@/lib/gamification";
import type { OnboardingAnswers } from "@/lib/types";

const STAGE_OF = new Map(CATEGORIES.map((c) => [c.id, c.stage]));

export default async function InsightsPage() {
  const business = (await getBusiness())!;
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
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant, completion_data: t.completion_data })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );

  return (
    <div className="pb-24 md:pb-8">
      <PageTitle eyebrow="מודיעין עסקי" title="תובנות" subtitle="ההתקדמות, ההישגים, העלויות והמועדים — במבט אחד" />

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
        {/* readiness breakdown */}
        <FadeIn>
          <Card className="h-full p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-section text-ink"><Gauge className="h-4.5 w-4.5 text-brand-400" aria-hidden />מוכנות לפי תחום</h2>
              <span className="tnum text-sm text-ink-muted">ציון כולל <b className="text-ink">{score.overall}</b></span>
            </div>
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

        {/* costs */}
        <FadeIn><CostsManager costs={costs} /></FadeIn>

        {/* compliance timeline */}
        {obligations.length > 0 && (
          <FadeIn>
            <Card className="h-full p-5">
              <h2 className="mb-3 flex items-center gap-2 text-section text-ink"><CalendarClock className="h-4.5 w-4.5 text-brand-400" aria-hidden />מה מתי — ציר המועדים</h2>
              <div className="relative pr-4">
                <span className="absolute bottom-1 right-[7px] top-1 w-px bg-edge" aria-hidden />
                <div className="flex flex-col gap-3">
                  {obligations.slice(0, 8).map((o) => (
                    <div key={o.id} className="relative flex items-center gap-3">
                      <span className={`absolute right-[-4px] h-2.5 w-2.5 rounded-full led ${o.daysUntil < 0 ? "text-status-overdue bg-status-overdue" : o.daysUntil <= 7 ? "text-status-progress bg-status-progress" : "text-brand-400 bg-brand-400"}`} />
                      <div className="mr-4 flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-ink-soft">{o.title}{o.periodLabel && <span className="text-ink-faint"> · {o.periodLabel}</span>}</span>
                        <span className="tnum shrink-0 text-xs font-semibold text-ink">{new Date(o.dueDate + "T00:00:00").toLocaleDateString("he-IL")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/calendar" className="mt-3 inline-block text-xs font-medium text-brand-strong hover:opacity-80">ללוח החובות המלא ←</Link>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
