"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  PartyPopper,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Card, FadeIn, Stat } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { MiniRing, ScoreRing } from "@/components/score-ring";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { fadeUp, spring, stagger } from "@/lib/motion";
import type { TaskPriority } from "@/lib/types";

export interface DashCategory {
  id: string;
  title: string;
  icon: string;
  score: number;
  done: number;
  total: number;
}
export interface DashStep {
  templateId: string;
  title: string;
  icon: string;
  priority: TaskPriority;
  dueDate: string | null;
  basis: "statutory" | "recommended";
}
export interface DashboardData {
  businessName: string;
  scoreOverall: number;
  categories: DashCategory[];
  doneCount: number;
  totalCount: number;
  overdueCount: number;
  profilePercent: number;
  steps: DashStep[];
  upcoming: { templateId: string; title: string; dueDate: string; basis: "statutory" | "recommended" }[];
  urgent: { templateId: string; title: string; dueDate: string; daysUntil: number; periodLabel: string | null } | null;
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="pb-24 md:pb-8">
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="mb-5">
        <p className="text-sm text-ink-muted">שלום 👋</p>
        <h1 className="text-title text-ink">{data.businessName}</h1>
      </motion.header>

      {/* what needs you now */}
      {data.urgent ? (
        <FadeIn className="mb-5">
          <Link
            href={
              data.urgent.templateId === "calendar"
                ? "/calendar"
                : `/tasks/${data.urgent.templateId}`
            }
          >
            <Card
              interactive
              className={`flex items-center gap-4 p-5 ${
                data.urgent.daysUntil < 0 ? "ring-1 ring-status-overdue/40" : ""
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  data.urgent.daysUntil < 0
                    ? "bg-status-overdue-bg text-status-overdue"
                    : "bg-brand-tint text-brand-strong"
                }`}
              >
                <CalendarClock className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-muted">מה דורש אותך עכשיו</p>
                <p className="truncate font-bold text-ink">{data.urgent.title}</p>
                <p className="text-sm text-ink-muted">
                  {data.urgent.periodLabel ? `${data.urgent.periodLabel} · ` : ""}
                  {data.urgent.daysUntil < 0
                    ? "עבר המועד"
                    : data.urgent.daysUntil === 0
                      ? "היום"
                      : `בעוד ${data.urgent.daysUntil} ימים`}
                </p>
              </div>
              <ArrowLeft className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden />
            </Card>
          </Link>
        </FadeIn>
      ) : (
        <FadeIn className="mb-5">
          <Card className="flex items-center gap-3 p-4">
            <ShieldCheck className="h-6 w-6 shrink-0 text-status-done" aria-hidden />
            <p className="text-sm text-ink-soft">אין מועד דחוף כרגע — הכול תחת שליטה.</p>
          </Card>
        </FadeIn>
      )}

      {/* status chips */}
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-5 grid grid-cols-3 gap-2.5"
      >
        <motion.div variants={fadeUp}>
          <Stat
            value={`${data.doneCount}/${data.totalCount}`}
            label="משימות הושלמו"
            icon={<CheckCircle2 className="h-4 w-4 text-status-done" aria-hidden />}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Stat
            value={data.overdueCount}
            label="באיחור"
            tone={data.overdueCount > 0 ? "overdue" : undefined}
            icon={
              <AlertTriangle
                className={`h-4 w-4 ${data.overdueCount > 0 ? "text-status-overdue" : "text-ink-faint"}`}
                aria-hidden
              />
            }
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Link href="/business">
            <Stat
              value={`${data.profilePercent}%`}
              label="פרופיל עסקי"
              icon={<UserRound className="h-4 w-4 text-brand-500" aria-hidden />}
            />
          </Link>
        </motion.div>
      </motion.div>

      {/* readiness */}
      <FadeIn>
        <Card elevated className="flex flex-col items-center gap-6 p-6 md:flex-row md:justify-between md:px-10">
          <ScoreRing score={data.scoreOverall} />
          <div className="grid w-full flex-1 grid-cols-2 gap-2.5 md:max-w-sm">
            {data.categories.map((c) => (
              <Link
                key={c.id}
                href={`/tasks?category=${c.id}`}
                className="flex items-center gap-2.5 rounded-xl border border-edge-soft p-2.5 transition hover:border-brand-edge hover:bg-brand-tint/40"
              >
                <div className="relative">
                  <MiniRing score={c.score} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-soft">
                    {c.score}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{c.title}</p>
                  <p className="text-[11px] text-ink-muted">
                    {c.done}/{c.total} הושלמו
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </FadeIn>

      {/* next steps */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section text-ink">הצעדים הבאים שלך</h2>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:opacity-80"
          >
            כל המשימות
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {data.steps.length === 0 ? (
          <Card className="p-6 text-center">
            <PartyPopper className="mx-auto h-8 w-8 text-status-done" aria-hidden />
            <p className="mt-2 font-semibold text-ink">סיימתם הכל — כל הכבוד!</p>
            <p className="text-sm text-ink-muted">נעדכן כאן כשמשימה מחזורית תחזור או כשהרגולציה תשתנה</p>
          </Card>
        ) : (
          <motion.div variants={stagger()} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {data.steps.map((s) => (
              <motion.div key={s.templateId} variants={fadeUp} transition={spring}>
                <Link href={`/tasks/${s.templateId}`} className="group block">
                  <Card interactive className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                      <CategoryIcon name={s.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{s.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={s.priority} />
                        <DueBadge dueDate={s.dueDate} basis={s.basis} />
                      </div>
                    </div>
                    <ArrowLeft className="h-5 w-5 shrink-0 text-ink-faint transition group-hover:text-brand-strong" aria-hidden />
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* upcoming */}
      {data.upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
            <CalendarClock className="h-4.5 w-4.5 text-ink-faint" aria-hidden />
            דדליינים קרובים
          </h2>
          <Card className="divide-y divide-edge-soft">
            {data.upcoming.map((t) => (
              <Link
                key={t.templateId + t.dueDate}
                href={t.templateId === "calendar" ? "/calendar" : `/tasks/${t.templateId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface/60"
              >
                <span className="truncate text-sm font-medium text-ink">{t.title}</span>
                <DueBadge dueDate={t.dueDate} basis={t.basis} />
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
