"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  FileCheck2,
  Flame,
  FolderCheck,
  Footprints,
  Landmark,
  Lock,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trophy,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { Card, FadeIn } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { fadeUp, spring, stagger } from "@/lib/motion";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints, Landmark, Rocket, FileCheck2, FolderCheck, BadgeCheck,
  ShieldCheck, Flame, TrendingUp, Trophy, Sparkles, Zap,
};
function Ic({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

export type ConfidenceState = "at_risk" | "on_track" | "covered";

export interface DashStage { id: string; title: string; done: number; total: number; }
export interface DashStep { templateId: string; title: string; icon: string; categoryTitle: string; locked: boolean; blockedByTitle: string | null; }

export interface DashboardData {
  businessName: string;
  confidence: { state: ConfidenceState; headline: string; detail: string };
  oneThing: { templateId: string; title: string; meta: string } | null;
  level: { level: number; title: string; progress: number; nextGap: number; nextTitle: string | null };
  scoreOverall: number;
  streak: number;
  week: { templateId: string; title: string; daysUntil: number }[];
  doneCount: number;
  totalCount: number;
  overdueCount: number;
  profilePercent: number;
  monthlyCost: number | null;
  stages: DashStage[];
  pathSteps: DashStep[];
  asideSteps: DashStep[];
  recentWins: { templateId: string; title: string }[];
  earnedBadges: { id: string; title: string; icon: string }[];
  badgeTotal: number;
}

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const AURORA = "linear-gradient(102deg,var(--aurora-from),var(--aurora-to))";

function daysPhrase(d: number) {
  if (d < 0) return "עבר המועד";
  if (d === 0) return "היום";
  if (d === 1) return "מחר";
  return `בעוד ${d} ימים`;
}

export function DashboardView({ data }: { data: DashboardData }) {
  const risk = data.confidence.state === "at_risk";
  const link = (id: string) => (id === "calendar" ? "/calendar" : `/tasks/${id}`);

  return (
    <div className="pb-24 md:pb-8">
      {/* ===== hero: confidence (big-type) + reactor ===== */}
      <div className="mb-4 grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-stretch">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className="text-sm font-medium text-ink-muted">{data.businessName}</p>
          <h1
            className="mt-1 text-[clamp(1.85rem,1.2rem+2.1vw,2.7rem)] font-extrabold leading-[1.1] tracking-tight text-balance"
            style={risk ? { color: "var(--status-overdue)" } : { background: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            {data.confidence.headline}
          </h1>

          {data.oneThing ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className={`eyebrow ${risk ? "text-status-overdue" : ""}`}>{risk ? "דורש טיפול" : "הדבר האחד עכשיו"}</span>
              <Link
                href={link(data.oneThing.templateId)}
                className="inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-[17px] font-bold text-[#0a0813] shadow-e-brand transition hover:opacity-95"
                style={{ background: risk ? "linear-gradient(100deg,#fb7185,#f43f5e)" : AURORA, color: risk ? "#fff" : "#0a0813" }}
              >
                {risk ? "לטפל עכשיו" : data.oneThing.title}
                <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
              </Link>
              <span className="text-[13px] text-ink-muted">{data.oneThing.meta}</span>
            </div>
          ) : (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-status-done-bg px-4 py-2.5 text-sm font-bold text-status-done">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> הכול תקין
            </div>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            מבוסס על מקורות רשמיים · מתעדכן כשהחוק משתנה
          </p>
        </motion.div>

        {/* reactor */}
        <FadeIn>
          <Card elevated className="relative flex h-full items-center gap-6 overflow-hidden p-6">
            <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle, var(--glow-c), transparent 70%)" }} />
            <Reactor score={data.scoreOverall} />
            <div className="relative min-w-0 flex-1">
              <p className="eyebrow">רמה {data.level.level} · מתוך 5</p>
              <p className="mt-1 text-[17px] font-bold leading-tight text-gradient">{data.level.title}</p>
              <div className="mt-3.5">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-ink-muted">{data.level.nextTitle ? "לרמה הבאה" : "הרמה הגבוהה ביותר"}</span>
                  {data.level.nextTitle && <span className="tnum font-bold" style={{ color: "var(--aurora-from)" }}>{data.level.nextGap} נק׳</span>}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(data.level.progress * 100)}%` }} transition={{ ...spring, delay: 0.15 }} className="h-full rounded-full" style={{ background: AURORA, boxShadow: "0 0 12px var(--accent-glow)" }} />
                </div>
              </div>
              {data.streak > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-status-progress">
                  <Flame className="h-4 w-4 animate-aura" aria-hidden /><span className="tnum">{data.streak}</span>
                  <span className="text-[11px] font-medium text-ink-muted">שבועות רצף</span>
                </div>
              )}
            </div>
          </Card>
        </FadeIn>
      </div>

      {/* ===== this week ===== */}
      <FadeIn className="mb-4">
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5">
          <span className="eyebrow shrink-0">השבוע</span>
          <span className="h-4 w-px bg-edge" />
          {data.week.length === 0 ? (
            <span className="flex items-center gap-2 text-sm text-ink-soft">
              <Check className="h-4 w-4 text-status-done" aria-hidden />
              אין מועדי חובה השבוע — התמקדו בהקמה, בקצב שלכם.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {data.week.map((w) => (
                <Link key={w.templateId + w.daysUntil} href={link(w.templateId)} className="inline-flex items-center gap-2 rounded-full border border-edge-soft bg-surface/40 px-3 py-1.5 text-[13px] transition hover:border-brand-edge">
                  <CalendarClock className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                  <span className="text-ink-soft">{w.title}</span>
                  <span className={`tnum text-[11px] font-semibold ${w.daysUntil <= 2 ? "text-status-progress" : "text-ink-muted"}`}>{daysPhrase(w.daysUntil)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </FadeIn>

      {/* ===== telemetry ===== */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tele icon={<CheckCircle2 className="h-3.5 w-3.5 text-status-done" />} label="הושלמו" value={`${data.doneCount}/${data.totalCount}`} />
        <Tele icon={<AlertTriangle className={`h-3.5 w-3.5 ${data.overdueCount > 0 ? "text-status-overdue" : "text-ink-faint"}`} />} label="באיחור" value={String(data.overdueCount)} warn={data.overdueCount > 0} />
        <Link href="/business"><Tele icon={<UserRound className="h-3.5 w-3.5 text-brand-400" />} label="פרופיל" value={`${data.profilePercent}%`} /></Link>
        <Link href="/insights"><Tele icon={<Wallet className="h-3.5 w-3.5 text-brand-400" />} label="עלות/חודש" value={data.monthlyCost != null ? nis(data.monthlyCost) : "—"} /></Link>
      </motion.div>

      {/* ===== journey rail ===== */}
      <FadeIn className="mb-4">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-section text-ink"><Rocket className="h-4.5 w-4.5 text-brand-400" aria-hidden />המסע שלך</h2>
            <Link href="/tasks" className="text-xs font-medium text-brand-strong hover:opacity-80">כל המשימות ←</Link>
          </div>
          <div className="relative flex items-start">
            <span className="absolute top-[27px] right-[8%] left-[8%] h-0.5" style={{ background: "linear-gradient(to left, rgba(52,211,153,0.55), rgba(129,140,248,0.6), rgba(255,255,255,0.07))" }} aria-hidden />
            {data.stages.map((s) => {
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
              const done = pct >= 100;
              const current = !done && pct > 0;
              return (
                <div key={s.id} className="relative flex flex-1 flex-col items-center gap-2.5">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2"
                    style={done
                      ? { background: "var(--status-done-bg)", borderColor: "var(--status-done)", color: "var(--status-done)", boxShadow: "0 0 22px rgba(16,185,129,0.4)" }
                      : current
                        ? { background: "linear-gradient(135deg, rgba(124,58,237,0.34), rgba(34,211,238,0.24))", borderColor: "#818cf8", color: "#eef1ff", boxShadow: "0 0 30px rgba(124,58,237,0.5)" }
                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)", color: "var(--ink-faint)" }}
                  >
                    {done ? <Check className="h-6 w-6" aria-hidden /> : <span className="tnum text-sm font-bold">{pct}%</span>}
                  </span>
                  <div className="text-center">
                    <div className={`text-[13.5px] font-bold ${current ? "text-brand-strong" : done ? "text-ink" : "text-ink-muted"}`}>{s.title}</div>
                    <div className="tnum text-[11px] text-ink-muted">{s.done}/{s.total}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </FadeIn>

      {/* ===== priorities + achievements ===== */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <FadeIn>
          <Card className="h-full p-6">
            <h2 className="mb-4 flex items-center gap-2 text-section text-ink"><Zap className="h-4.5 w-4.5 text-brand-400" aria-hidden />הצעדים הבאים</h2>
            {data.pathSteps.length === 0 ? (
              <p className="text-sm text-ink-muted">כל שלבי ההקמה טופלו — יופי.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.pathSteps.map((p, i) => (
                  <StepRow key={p.templateId} step={p} lead={i === 0 && !p.locked} />
                ))}
              </div>
            )}
            {data.asideSteps.length > 0 && (
              <>
                <p className="eyebrow mb-2.5 mt-5">על הדרך · אפשר גם עכשיו</p>
                <div className="flex flex-col gap-2">
                  {data.asideSteps.map((a) => <StepRow key={a.templateId} step={a} />)}
                </div>
              </>
            )}
            <Link
              href="/settings"
              className="mt-5 flex items-center gap-2.5 border-t border-edge-soft pt-4 text-[13px] text-ink-muted transition hover:text-brand-strong"
            >
              <SlidersHorizontal className="h-4 w-4 text-brand-400" aria-hidden />
              <span>השתנה משהו בעסק? <span className="font-semibold text-ink-soft">כיילו את התכנית</span> — נראה לכם מה ישתנה לפני שמאשרים</span>
            </Link>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-section text-ink"><Trophy className="h-4.5 w-4.5 text-status-progress" aria-hidden />הישגים</h2>
              <span className="tnum text-xs text-ink-muted">{data.earnedBadges.length}/{data.badgeTotal}</span>
            </div>
            {data.earnedBadges.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {data.earnedBadges.slice(0, 6).map((b) => (
                  <div key={b.id} className="flex flex-col items-center gap-2 rounded-2xl border border-brand-edge bg-brand-tint/40 p-3 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-e-brand" style={{ background: AURORA }}><Ic name={b.icon} className="h-5 w-5" /></span>
                    <span className="text-[10.5px] font-bold leading-tight text-ink">{b.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">ההישגים הראשונים בדרך — כל משימה שתסגרו תופיע כאן.</p>
            )}
            {data.recentWins.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-edge-soft pt-3">
                {data.recentWins.slice(0, 6).map((w) => (
                  <Link key={w.templateId} href={`/tasks/${w.templateId}`} className="inline-flex items-center gap-1 rounded-full border border-edge-soft bg-surface/40 px-2.5 py-1 text-[11px] text-ink-soft transition hover:border-brand-edge">
                    <CheckCircle2 className="h-3 w-3 text-status-done" aria-hidden />{w.title}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function StepRow({ step, lead }: { step: DashStep; lead?: boolean }) {
  if (step.locked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-edge-soft/70 p-3 opacity-70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-faint"><Lock className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-soft">{step.title}</p>
          <p className="truncate text-[11px] text-ink-faint">{step.blockedByTitle ? `יפתח אחרי: ${step.blockedByTitle}` : step.categoryTitle}</p>
        </div>
      </div>
    );
  }
  return (
    <Link href={`/tasks/${step.templateId}`} className={`group flex items-center gap-3 rounded-2xl p-3.5 transition ${lead ? "border border-brand-edge bg-brand-tint/40" : "border border-edge-soft hover:border-brand-edge"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong"><CategoryIcon name={step.icon} className="h-4.5 w-4.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{step.title}</p>
        <p className="truncate text-[11px] text-ink-muted">{step.categoryTitle}</p>
      </div>
      <ArrowLeft className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:text-brand-strong" aria-hidden />
    </Link>
  );
}

function Reactor({ score }: { score: number }) {
  const size = 118, stroke = 9, r = (size - stroke) / 2 - 4, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id="reactor" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--aurora-from)" /><stop offset="60%" stopColor="#818cf8" /><stop offset="100%" stopColor="var(--aurora-to)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r + 6} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#reactor)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={spring} style={{ filter: "drop-shadow(0 0 11px var(--accent-glow))" }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[34px] font-bold leading-none text-ink">{Math.round(score)}</span>
        <span className="eyebrow mt-1.5">מוכנות</span>
      </span>
    </span>
  );
}

function Tele({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <Card className={`flex flex-col gap-1.5 px-4 py-3.5 ${warn ? "ring-1 ring-status-overdue/30" : ""}`}>
      <span className="flex items-center gap-1.5">{icon}<span className="eyebrow">{label}</span></span>
      <span className="tnum text-xl font-bold text-ink">{value}</span>
    </Card>
  );
}
