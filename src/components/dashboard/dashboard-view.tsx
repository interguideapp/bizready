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
import { Card, Chip, FadeIn } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
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
  return (
    <div className="pb-24 md:pb-8">
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="mb-5">
        <p className="text-sm text-ink-muted">מרכז הבקרה של</p>
        <h1 className="text-title text-ink">{data.businessName}</h1>
      </motion.header>

      {/* ===== readiness command panel ===== */}
      <FadeIn className="mb-4">
        <Card elevated className="relative overflow-hidden p-6">
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 70%)" }}
          />
          <div className="relative flex items-center gap-5">
            <LevelRing level={data.level.level} progress={data.level.progress} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                רמת מוכנות {data.level.level}
              </p>
              <p className="text-gradient text-2xl font-extrabold">{data.level.title}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {data.level.nextTitle
                  ? <>עוד <span className="tnum font-semibold text-ink-soft">{Math.max(0, (data.level.nextAt ?? 0) - data.level.xp)}</span> נק' ל<b className="text-ink-soft">{data.level.nextTitle}</b></>
                  : "הגעתם לרמה הגבוהה ביותר 🎉"}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
              <div className={`flex items-center gap-1 text-lg font-bold ${data.streak > 0 ? "text-status-progress" : "text-ink-faint"}`}>
                <Flame className={`h-5 w-5 ${data.streak > 0 ? "animate-aura" : ""}`} aria-hidden />
                <span className="tnum">{data.streak}</span>
              </div>
              <span className="text-[10px] font-medium text-ink-muted">שבועות רצף</span>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* ===== urgent ===== */}
      {data.urgent && (
        <FadeIn className="mb-4">
          <Link href={data.urgent.templateId === "calendar" ? "/calendar" : `/tasks/${data.urgent.templateId}`}>
            <Card interactive className={`flex items-center gap-4 p-4 ${data.urgent.daysUntil < 0 ? "ring-1 ring-status-overdue/40" : ""}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${data.urgent.daysUntil < 0 ? "bg-status-overdue-bg text-status-overdue" : "bg-brand-tint text-brand-strong"}`}>
                <CalendarClock className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-muted">מה דורש אותך עכשיו</p>
                <p className="truncate font-bold text-ink">{data.urgent.title}</p>
              </div>
              <div className="shrink-0 text-left">
                <p className={`tnum text-sm font-bold ${data.urgent.daysUntil < 0 ? "text-status-overdue" : "text-ink"}`}>
                  {data.urgent.daysUntil < 0 ? "עבר" : data.urgent.daysUntil === 0 ? "היום" : `${data.urgent.daysUntil} ימים`}
                </p>
                {data.urgent.periodLabel && <p className="text-[11px] text-ink-muted">{data.urgent.periodLabel}</p>}
              </div>
            </Card>
          </Link>
        </FadeIn>
      )}

      {/* ===== next move ===== */}
      {data.nextAction && (
        <FadeIn className="mb-4">
          <Link href={`/tasks/${data.nextAction.templateId}`}>
            <Card interactive className="flex items-center gap-4 border-brand-edge/60 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-e-brand">
                <Zap className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-brand-strong">הצעד הבא המומלץ</p>
                <p className="truncate font-bold text-ink">{data.nextAction.title}</p>
              </div>
              <ArrowLeft className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden />
            </Card>
          </Link>
        </FadeIn>
      )}

      {/* ===== readouts ===== */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Readout icon={<CheckCircle2 className="h-4 w-4 text-status-done" />} value={`${data.doneCount}/${data.totalCount}`} label="משימות" />
        <Readout icon={<AlertTriangle className={`h-4 w-4 ${data.overdueCount > 0 ? "text-status-overdue" : "text-ink-faint"}`} />} value={String(data.overdueCount)} label="באיחור" warn={data.overdueCount > 0} />
        <Link href="/business"><Readout icon={<UserRound className="h-4 w-4 text-brand-400" />} value={`${data.profilePercent}%`} label="פרופיל" /></Link>
        <Link href="/insights"><Readout icon={<Wallet className="h-4 w-4 text-brand-400" />} value={data.monthlyCost != null ? nis(data.monthlyCost) : "—"} label="עלות חודשית" /></Link>
      </motion.div>

      {/* ===== journey stages ===== */}
      <FadeIn className="mb-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-section text-ink"><Rocket className="h-4.5 w-4.5 text-brand-400" aria-hidden />המסע שלכם</h2>
            <Link href="/tasks" className="text-xs font-medium text-brand-strong hover:opacity-80">כל המשימות ←</Link>
          </div>
          <div className="flex flex-col gap-3">
            {data.stages.map((s) => {
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-soft">{s.title}</span>
                    <span className="tnum text-xs text-ink-muted">{s.done}/{s.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
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

      {/* ===== wins + badges ===== */}
      {(data.recentWins.length > 0 || data.earnedBadges.length > 0) && (
        <FadeIn className="mb-4">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-section text-ink"><Trophy className="h-4.5 w-4.5 text-status-progress" aria-hidden />הישגים ונצחונות</h2>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
      )}

      {/* ===== category grid ===== */}
      <FadeIn className="mb-4">
        <Card className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
          {data.categories.map((c) => (
            <Link key={c.id} href={`/tasks?category=${c.id}`} className="flex items-center gap-2.5 rounded-xl border border-edge-soft p-2.5 transition hover:border-brand-edge hover:bg-brand-tint/30">
              <div className="relative">
                <MiniRing score={c.score} />
                <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-soft">{c.score}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">{c.title}</p>
                <p className="tnum text-[11px] text-ink-muted">{c.done}/{c.total}</p>
              </div>
            </Link>
          ))}
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

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const size = 84, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-from)" />
            <stop offset="100%" stopColor="var(--accent-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lvl)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, progress))) }}
          transition={spring} style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium text-ink-muted">רמה</span>
        <span className="tnum text-2xl font-extrabold text-ink">{level}</span>
      </span>
    </span>
  );
}

function Readout({ icon, value, label, warn }: { icon: React.ReactNode; value: string; label: string; warn?: boolean }) {
  return (
    <Card className={`flex flex-col gap-0.5 px-3 py-3 text-center ${warn ? "ring-1 ring-status-overdue/30" : ""}`}>
      <span className="tnum flex items-center justify-center gap-1.5 text-lg font-bold text-ink">{icon}{value}</span>
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
    </Card>
  );
}
