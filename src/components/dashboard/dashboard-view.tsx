"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Flame,
  FolderCheck,
  Footprints,
  Landmark,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserRound,
  Wallet,
  Zap,
  FileCheck2,
} from "lucide-react";
import { Card, FadeIn } from "@/components/ui";
import { MiniRing } from "@/components/score-ring";
import { DueBadge } from "@/components/badges";
import { fadeUp, spring, stagger } from "@/lib/motion";
import type { TaskPriority } from "@/lib/types";

/** map badge/win icon names to components */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints, Landmark, Rocket, FileCheck2, FolderCheck, BadgeCheck,
  ShieldCheck, Flame, TrendingUp, Trophy, Sparkles, Zap,
};
function Ic({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

export interface DashCategory {
  id: string; title: string; icon: string; score: number; done: number; total: number;
}
export interface DashStage {
  id: string; title: string; done: number; total: number;
}
export interface DashboardData {
  businessName: string;
  level: { level: number; title: string; xp: number; nextAt: number | null; progress: number; nextTitle: string | null };
  streak: number;
  scoreOverall: number;
  categories: DashCategory[];
  stages: DashStage[];
  doneCount: number;
  totalCount: number;
  overdueCount: number;
  profilePercent: number;
  monthlyCost: number | null;
  nextAction: { templateId: string; title: string; icon: string; priority: TaskPriority } | null;
  recentWins: { templateId: string; title: string; icon: string; date: string | null }[];
  earnedBadges: { id: string; title: string; icon: string }[];
  urgent: { templateId: string; title: string; dueDate: string; daysUntil: number; periodLabel: string | null } | null;
  upcoming: { templateId: string; title: string; dueDate: string; basis: "statutory" | "recommended" }[];
}

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export function DashboardView({ data }: { data: DashboardData }) {
  const nextGap = Math.max(0, (data.level.nextAt ?? 0) - data.level.xp);
  return (
    <div className="pb-24 md:pb-8">
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">מרכז הבקרה</p>
          <h1 className="text-display text-ink">{data.businessName}</h1>
        </div>
        <div className={`hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${data.streak > 0 ? "border-status-progress/30 bg-status-progress-bg/40 text-status-progress" : "border-edge bg-card text-ink-faint"}`}>
          <Flame className={`h-4 w-4 ${data.streak > 0 ? "animate-aura" : ""}`} aria-hidden />
          <span className="tnum text-sm font-bold">{data.streak}</span>
          <span className="text-[11px] font-medium text-ink-muted">שבועות רצף</span>
        </div>
      </motion.header>

      {/* ===== hero band: readiness (2/3) + action stack (1/3) ===== */}
      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        {/* readiness — the one trusted number */}
        <FadeIn className="lg:col-span-2">
          <Card elevated className="relative h-full overflow-hidden p-6">
            <div
              className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 70%)" }}
            />
            <div className="relative flex h-full flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-right">
              <ScoreGauge score={data.scoreOverall} />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">מוכנות העסק · רמה {data.level.level}</p>
                <p className="text-gradient mt-1 text-2xl font-extrabold leading-tight">{data.level.title}</p>
                <div className="mt-3 max-w-xs">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-ink-muted">
                      {data.level.nextTitle ? <>לרמה הבאה · {data.level.nextTitle}</> : "הרמה הגבוהה ביותר"}
                    </span>
                    {data.level.nextTitle && <span className="tnum font-semibold text-ink-soft">{nextGap} נק'</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.round(data.level.progress * 100)}%` }}
                      transition={{ ...spring, delay: 0.15 }}
                      className="h-full rounded-full bg-gradient-to-l from-brand-500 to-accent-to"
                      style={{ boxShadow: "0 0 10px var(--accent-glow)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </FadeIn>

        {/* action stack — what needs you / what's next */}
        <div className="flex flex-col gap-3">
          {data.urgent && (
            <FadeIn className="flex-1">
              <Link href={data.urgent.templateId === "calendar" ? "/calendar" : `/tasks/${data.urgent.templateId}`} className="block h-full">
                <Card interactive className={`flex h-full flex-col justify-between gap-3 p-4 ${data.urgent.daysUntil < 0 ? "ring-1 ring-status-overdue/40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">מה דורש אותך עכשיו</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${data.urgent.daysUntil < 0 ? "bg-status-overdue-bg text-status-overdue" : "bg-brand-tint text-brand-strong"}`}>
                      <CalendarClock className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <div>
                    <p className="line-clamp-2 font-bold leading-snug text-ink">{data.urgent.title}</p>
                    <p className={`tnum mt-1 text-xs font-bold ${data.urgent.daysUntil < 0 ? "text-status-overdue" : "text-ink-soft"}`}>
                      {data.urgent.daysUntil < 0 ? "עבר המועד" : data.urgent.daysUntil === 0 ? "היום" : `בעוד ${data.urgent.daysUntil} ימים`}
                      {data.urgent.periodLabel && <span className="font-normal text-ink-muted"> · {data.urgent.periodLabel}</span>}
                    </p>
                  </div>
                </Card>
              </Link>
            </FadeIn>
          )}
          {data.nextAction && (
            <FadeIn className="flex-1">
              <Link href={`/tasks/${data.nextAction.templateId}`} className="block h-full">
                <Card interactive className="flex h-full flex-col justify-between gap-3 border-brand-edge/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-brand-strong">הצעד הבא המומלץ</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-e-brand">
                      <Zap className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="line-clamp-2 font-bold leading-snug text-ink">{data.nextAction.title}</p>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  </div>
                </Card>
              </Link>
            </FadeIn>
          )}
          {!data.urgent && !data.nextAction && (
            <FadeIn className="flex-1">
              <Card className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                <CheckCircle2 className="h-7 w-7 text-status-done" aria-hidden />
                <p className="text-sm font-semibold text-ink">אין משימות דחופות</p>
                <p className="text-xs text-ink-muted">הכול תחת שליטה — כל הכבוד</p>
              </Card>
            </FadeIn>
          )}
        </div>
      </div>

      {/* ===== readouts strip ===== */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Readout icon={<CheckCircle2 className="h-3.5 w-3.5 text-status-done" />} value={`${data.doneCount}/${data.totalCount}`} label="משימות הושלמו" />
        <Readout icon={<AlertTriangle className={`h-3.5 w-3.5 ${data.overdueCount > 0 ? "text-status-overdue" : "text-ink-faint"}`} />} value={String(data.overdueCount)} label="באיחור" warn={data.overdueCount > 0} />
        <Link href="/business"><Readout icon={<UserRound className="h-3.5 w-3.5 text-brand-400" />} value={`${data.profilePercent}%`} label="פרופיל העסק" /></Link>
        <Link href="/insights"><Readout icon={<Wallet className="h-3.5 w-3.5 text-brand-400" />} value={data.monthlyCost != null ? nis(data.monthlyCost) : "—"} label="עלות חודשית" /></Link>
      </motion.div>

      {/* ===== journey + achievements (side by side) ===== */}
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <FadeIn>
          <Card className="h-full p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-section text-ink"><Rocket className="h-4.5 w-4.5 text-brand-400" aria-hidden />המסע שלכם</h2>
              <Link href="/tasks" className="text-xs font-medium text-brand-strong hover:opacity-80">כל המשימות ←</Link>
            </div>
            <div className="flex flex-col gap-3.5">
              {data.stages.map((s) => {
                const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <div key={s.id}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-ink-soft">{s.title}</span>
                      <span className="tnum text-xs text-ink-muted">{s.done}/{s.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ ...spring, delay: 0.1 }}
                        className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </FadeIn>

        {(data.recentWins.length > 0 || data.earnedBadges.length > 0) ? (
          <FadeIn>
            <Card className="h-full p-5">
              <h2 className="mb-4 flex items-center gap-2 text-section text-ink"><Trophy className="h-4.5 w-4.5 text-status-progress" aria-hidden />הישגים ונצחונות</h2>
              {data.earnedBadges.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {data.earnedBadges.map((b) => (
                    <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-edge bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand-strong">
                      <Ic name={b.icon} className="h-3.5 w-3.5" />
                      {b.title}
                    </span>
                  ))}
                </div>
              )}
              {data.recentWins.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.recentWins.slice(0, 6).map((w) => (
                    <Link key={w.templateId} href={`/tasks/${w.templateId}`} className="flex items-center gap-2 rounded-xl border border-edge-soft bg-surface/40 px-3 py-2 transition hover:border-brand-edge">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-status-done-bg text-status-done">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-soft">{w.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Trophy className="h-8 w-8 text-ink-faint" aria-hidden />
              <p className="text-sm font-semibold text-ink">ההישגים הראשונים בדרך</p>
              <p className="text-xs text-ink-muted">כל משימה שתסגרו תופיע כאן</p>
            </Card>
          </FadeIn>
        )}
      </div>

      {/* ===== category coverage (bento) ===== */}
      <FadeIn className="mb-3">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-section text-ink"><Sparkles className="h-4.5 w-4.5 text-brand-400" aria-hidden />כיסוי לפי תחום</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {data.categories.map((c) => (
              <Link key={c.id} href={`/tasks?category=${c.id}`} className="group flex items-center gap-2.5 rounded-xl border border-edge-soft bg-surface/30 p-2.5 transition hover:border-brand-edge hover:bg-brand-tint/30">
                <div className="relative shrink-0">
                  <MiniRing score={c.score} />
                  <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-soft">{c.score}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{c.title}</p>
                  <p className="tnum text-[11px] text-ink-muted">{c.done}/{c.total}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </FadeIn>

      {/* ===== upcoming ===== */}
      {data.upcoming.length > 0 && (
        <FadeIn>
          <h2 className="mb-3 flex items-center gap-2 text-section text-ink"><CalendarClock className="h-4.5 w-4.5 text-ink-faint" aria-hidden />דדליינים קרובים</h2>
          <Card className="divide-y divide-edge-soft">
            {data.upcoming.map((t) => (
              <Link key={t.templateId + t.dueDate} href={t.templateId === "calendar" ? "/calendar" : `/tasks/${t.templateId}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface/40">
                <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                <DueBadge dueDate={t.dueDate} basis={t.basis} />
              </Link>
            ))}
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

/** The readiness gauge — a luminous ring around the single trusted number. */
function ScoreGauge({ score }: { score: number }) {
  const size = 132, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="score-gauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-from)" />
            <stop offset="100%" stopColor="var(--accent-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#score-gauge)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={spring} style={{ filter: "drop-shadow(0 0 8px var(--accent-glow))" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[2.7rem] font-bold leading-none text-ink">{Math.round(score)}</span>
        <span className="mt-1 text-[10px] font-medium tracking-wide text-ink-muted">ציון מוכנות</span>
      </span>
    </span>
  );
}

function Readout({ icon, value, label, warn }: { icon: React.ReactNode; value: string; label: string; warn?: boolean }) {
  return (
    <Card className={`flex flex-col gap-1.5 px-4 py-3.5 ${warn ? "ring-1 ring-status-overdue/30" : ""}`}>
      <span className="flex items-center gap-1.5">{icon}<span className="eyebrow">{label}</span></span>
      <span className="tnum text-xl font-bold text-ink">{value}</span>
    </Card>
  );
}
