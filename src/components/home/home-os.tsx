"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BatteryFull,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Flame,
  FolderOpen,
  Gauge,
  History,
  Hourglass,
  PiggyBank,
  Signal,
  Sparkles,
  Store,
  UserRound,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { greetingFor, type QuickWin } from "@/lib/home";
import type { ConfidenceState } from "@/lib/confidence";
import { formatIlsRounded } from "@/lib/money";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet, UserRound, FolderOpen, Store, Zap, FileCheck2, CheckCircle2, Flame,
  CalendarClock, Gauge, PiggyBank, Sparkles, Clock3, Hourglass,
};
function Ic({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

// One formatter for the whole app — see lib/money.ts. Rounded here because
// these are aggregates and chart labels, where agorot are noise.
const nis = formatIlsRounded;

export interface HomeOSData {
  name: string;
  confidence: { state: ConfidenceState; headline: string; detail: string };
  oneThing: { title: string; href: string } | null;
  waiting: { title: string; waitingFor: string | null; followUp: string | null; href: string }[];
  quickWins: QuickWin[];
  completeness: { percent: number; missing: { label: string; href: string }[] };
  nextDeadline: { title: string; date: string; daysUntil: number } | null;
  /**
   * Statutory filings whose dates we cannot compute because the user set the
   * unlocking task aside as "not relevant". Gating them is the safe behaviour,
   * but gating them SILENTLY would trade a fabricated deadline for a missing
   * one — so the home screen says so, and names what to undo.
   */
  blockedFilings: { title: string; blockedByTitle: string; href: string }[];
  /**
   * Obligations ranked by what ignoring them will actually cost — severity x
   * proximity x certainty — rather than by how soon they fall due. The score
   * itself is never displayed; it decides the order, and each row states its
   * consequence in words.
   */
  /**
   * Rule changes that affect THIS business — targeted by the templates in its
   * own plan, not broadcast. The source watcher tells the team a page moved;
   * this is what finally reaches the user.
   */
  ruleChanges: {
    id: string;
    title: string;
    href: string;
    summary: string;
    kindLabel: string;
    sourceUrl: string;
    effectiveFrom: string | null;
    consequential: boolean;
  }[];
  ruleChangesBanner: string | null;
  exposures: {
    title: string;
    href: string;
    dueLabel: string;
    severityLabel: string;
    consequence: string;
    overdue: boolean;
  }[];
  tiles: {
    readiness: number;
    money: { hasIncome: boolean; setAsideLow: number; setAsideHigh: number; monthRevenue: number; showSetAside: boolean };
    streak: number;
    docsCount: number;
    done: number;
    total: number;
    profilePercent: number;
  };
  activity: { text: string; when: string; icon: string }[];
}

/**
 * Live HH:MM clock + Hebrew date, from the viewer's own device time.
 *
 * This used to tick every 1000ms, re-rendering the entire home screen — the
 * heaviest screen in the app, with four concurrent compositor animations on it
 * — once a second. The display has no seconds, so 59 of every 60 of those
 * renders changed nothing at all. On a mid-range Android that is pure battery
 * drain for no visible effect.
 *
 * It now wakes on the minute boundary, and not at all while the tab is hidden.
 */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const d = new Date();
      setNow(d);
      // Align to the next minute rather than drifting on a fixed interval.
      const msToNextMinute = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = setTimeout(tick, msToNextMinute);
    };

    const start = () => {
      if (timer) clearTimeout(timer);
      tick();
    };
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return now;
}

export function HomeOS({ data }: { data: HomeOSData }) {
  const now = useNow();
  const time = now
    ? now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : "‏‏‎ ";
  const dateLine = now
    ? now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const greeting = now ? greetingFor(now.getHours()) : "שלום";
  const atRisk = data.confidence.state === "at_risk";

  return (
    <div className="relative min-h-[calc(100dvh-1px)]" dir="rtl">
      <div className="os-glow" aria-hidden />

      {/* device status bar — frames the surface as an OS, not a page */}
      <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 pt-4 text-ink-soft/70">
        <span className="text-xs font-semibold tracking-wide">{dateLine || "‏"}</span>
        <span className="flex items-center gap-1.5">
          <Signal className="h-3.5 w-3.5" aria-hidden />
          <Wifi className="h-3.5 w-3.5" aria-hidden />
          <BatteryFull className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-36 pt-6 sm:pt-10">
        {/* ===== lock-screen hero ===== */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          // 42vh pushed the primary action below the fold on a short phone.
          // Reserve the dramatic height only where the viewport can afford it.
          className="flex min-h-[30vh] flex-col items-center justify-center text-center sm:min-h-[38vh] lg:min-h-[42vh]"
        >
          <p className="eyebrow mb-2">{greeting}, {data.name}</p>
          <div className="tnum text-[clamp(3.6rem,2.5rem+7vw,6.5rem)] font-extralight leading-none tracking-tight text-ink">
            {time}
          </div>
          <p className="mt-2 text-sm text-ink-muted">{dateLine}</p>

          <div
            className={`mt-5 inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm ${
              atRisk
                ? "border-status-overdue/40 bg-status-overdue/10 text-status-overdue"
                : "border-edge-strong bg-card/50 text-ink-soft"
            }`}
          >
            {atRisk ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : <Sparkles className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />}
            <span className="truncate font-medium">{data.confidence.headline}</span>
          </div>
        </motion.header>

        {/* ===== the one thing ===== */}
        {data.oneThing && (
          <FadeUp delay={0.05}>
            <Link href={data.oneThing.href} className="block">
              <div className="os-card group flex items-center gap-3 rounded-3xl p-4 transition hover:-translate-y-0.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-tint text-brand-strong">
                  <Zap className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">הצעד הבא</p>
                  <p className="truncate text-base font-bold text-ink">{data.oneThing.title}</p>
                </div>
                <ArrowLeft className="h-5 w-5 shrink-0 text-ink-faint transition group-hover:text-brand-strong" aria-hidden />
              </div>
            </Link>
          </FadeUp>
        )}

        {/* ===== complete the business file ===== */}
        {data.completeness.missing.length > 0 && (
          <FadeUp delay={0.08}>
            <div className="os-card os-sheen rounded-3xl p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4.5 w-4.5 text-brand-400" aria-hidden />
                  <h2 className="text-section text-ink">מה חסר לתיק העסק</h2>
                </div>
                <span className="tnum text-sm font-bold text-ink">{data.completeness.percent}%</span>
              </div>
              <div className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400 transition-[width] duration-500"
                  style={{ width: `${data.completeness.percent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {data.completeness.missing.map((m, i) => (
                  <Link
                    key={i}
                    href={m.href}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-surface/50 px-3 py-1.5 text-sm text-ink-soft transition hover:border-brand-edge hover:text-ink"
                  >
                    <Circle className="h-3.5 w-3.5 text-ink-faint transition group-hover:text-brand-400" aria-hidden />
                    {m.label}
                  </Link>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-faint">לחיצה על פריט לוקחת אתכם ישר להשלמה שלו</p>
            </div>
          </FadeUp>
        )}

        {/* ===== a rule that affects YOU changed =====
            First on the page when present. The source watcher tells the team a
            page moved; this is the only thing that reaches the user, and a
            moved deadline can make them late through no fault of their own.
            Targeted by the templates in their own plan — a broadcast notice
            would teach them to dismiss these. */}
        {data.ruleChanges.length > 0 && (
          <FadeUp delay={0.04}>
            <div className="os-card rounded-3xl border border-brand-edge p-5">
              <div className="mb-1 flex items-center gap-2">
                <BadgeCheck className="h-4.5 w-4.5 text-brand-400" aria-hidden />
                <h2 className="text-section text-ink">
                  {data.ruleChangesBanner ?? "עדכון רגולציה"}
                </h2>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-ink-muted">
                בדקנו מול המקור הרשמי ועדכנו את התוכן. זה מה שהשתנה במה שרלוונטי
                לכם:
              </p>
              <div className="flex flex-col gap-2">
                {data.ruleChanges.map((c) => (
                  <Link
                    key={c.id}
                    href={c.href}
                    className={`group flex flex-col gap-1 rounded-2xl border p-3 transition hover:border-brand-edge ${
                      c.consequential
                        ? "border-brand-edge bg-brand-tint/30"
                        : "border-edge-soft bg-surface/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {c.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
                        {c.kindLabel}
                      </span>
                      <ArrowLeft
                        className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-brand-strong"
                        aria-hidden
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {c.summary}
                      {c.effectiveFrom && (
                        <span className="text-ink-soft">
                          {" "}
                          בתוקף מ-
                          <time dateTime={c.effectiveFrom} dir="ltr">
                            {c.effectiveFrom.split("-").reverse().join(".")}
                          </time>
                        </span>
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </FadeUp>
        )}

        {/* ===== ranked by what it will cost, not by what is nearest ===== */}
        {data.exposures.length > 0 && (
          <FadeUp delay={0.06}>
            <div className="os-card rounded-3xl p-5">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-brand-400" aria-hidden />
                <h2 className="text-section text-ink">מה באמת עלול לעלות לכם</h2>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-ink-muted">
                לפי חומרה, קרבה למועד ומידת הוודאות שהחובה חלה עליכם — לא לפי מה
                שהכי קרוב בלוח השנה.
              </p>
              <div className="flex flex-col gap-2">
                {data.exposures.map((e, i) => (
                  <Link
                    key={i}
                    href={e.href}
                    className={`group flex flex-col gap-1 rounded-2xl border p-3 transition hover:border-brand-edge ${
                      e.overdue
                        ? "border-status-overdue/30 bg-status-overdue-bg/30"
                        : "border-edge-soft bg-surface/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {e.title}
                      </span>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          e.overdue ? "text-status-overdue" : "text-ink-muted"
                        }`}
                      >
                        {e.dueLabel}
                      </span>
                      <ArrowLeft
                        className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-brand-strong"
                        aria-hidden
                      />
                    </div>
                    {/* The consequence in words. The score that produced this
                        ordering is never shown — "risk score 47" is exactly the
                        meaningless metric this replaced. */}
                    <p className="text-xs leading-relaxed text-ink-muted">
                      <b className="text-ink-soft">{e.severityLabel}.</b> {e.consequence}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </FadeUp>
        )}

        {/* ===== statutory dates we deliberately stopped computing ===== */}
        {data.blockedFilings.length > 0 && (
          <FadeUp delay={0.1}>
            <div className="os-card rounded-3xl border border-status-overdue/25 p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-status-overdue" aria-hidden />
                <h2 className="text-section text-ink">מועדים שאנחנו לא מחשבים לך</h2>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-ink-muted">
                סימנתם משימה כלא רלוונטית, והיא תנאי מקדים לחובה חוקית. אנחנו לא
                נמציא לכם מועד שאין לנו בסיס לחשב — אבל גם לא נשתוק על זה.
              </p>
              <div className="flex flex-col gap-2">
                {data.blockedFilings.map((b, i) => (
                  <Link
                    key={i}
                    href={b.href}
                    className="group flex items-center gap-3 rounded-2xl border border-edge-soft bg-surface/50 p-3 transition hover:border-brand-edge"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{b.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {"תלוי ב: " + b.blockedByTitle}
                      </p>
                    </div>
                    <ArrowLeft
                      className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-brand-strong"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                אם זה בעצם מטופל אצלכם מחוץ ל-BizReady — פתחו את המשימה ושנו את
                סיבת ההסרה, ונחזיר את המועדים.
              </p>
            </div>
          </FadeUp>
        )}

        {/* ===== waiting on approval ===== */}
        <FadeUp delay={0.1}>
          <div className="os-card rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <Hourglass className="h-4.5 w-4.5 text-brand-400" aria-hidden />
              <h2 className="text-section text-ink">ממתין לאישור</h2>
              {data.waiting.length > 0 && (
                <span className="tnum ms-auto rounded-full bg-surface px-2 py-0.5 text-xs text-ink-muted">
                  {data.waiting.length}
                </span>
              )}
            </div>
            {data.waiting.length === 0 ? (
              <p className="text-sm text-ink-muted">
                אין כרגע משימות שממתינות לגורם חיצוני — הכדור אצלכם.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.waiting.map((w, i) => (
                  <Link
                    key={i}
                    href={w.href}
                    className="group flex items-center gap-3 rounded-2xl border border-edge-soft bg-surface/50 p-3 transition hover:border-brand-edge"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-status-progress-bg text-status-progress">
                      <Clock3 className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{w.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {w.waitingFor ? `ממתין ל${w.waitingFor}` : "ממתין לתשובה"}
                        {w.followUp ? ` · מעקב ${w.followUp}` : ""}
                      </p>
                    </div>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:text-brand-strong" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </FadeUp>

        {/* ===== quick wins ===== */}
        {data.quickWins.length > 0 && (
          <FadeUp delay={0.15}>
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-brand-400" aria-hidden />
                <h2 className="text-section text-ink">אפשר עכשיו · דקות ספורות</h2>
              </div>
              <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
                {data.quickWins.map((q) => (
                  <Link
                    key={q.id}
                    href={q.href}
                    className="os-card group flex w-52 shrink-0 flex-col gap-2 rounded-2xl p-3.5 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                        <Ic name={q.icon} className="h-4.5 w-4.5" />
                      </span>
                      <span className="tnum flex items-center gap-1 text-xs text-ink-faint">
                        <Clock3 className="h-3 w-3" aria-hidden />~{q.minutes} ד׳
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{q.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-ink-muted">{q.sublabel}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </FadeUp>
        )}

        {/* ===== OS widget grid ===== */}
        <FadeUp delay={0.2}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <OSTile
              href="/insights"
              icon={<Gauge className="h-4.5 w-4.5 text-brand-400" />}
              label="מוכנות"
              value={`${data.tiles.readiness}`}
              suffix="/100"
              detail={<>הציון הכולל שלכם. מבוסס על המשימות שסימנתם כהושלמו — כל משימה שתסגרו מעלה אותו.</>}
            />
            <OSTile
              href="/insights"
              icon={<PiggyBank className="h-4.5 w-4.5 text-brand-400" />}
              label="להפריש למיסים"
              value={
                data.tiles.money.hasIncome
                  ? data.tiles.money.showSetAside
                    ? nis(data.tiles.money.setAsideLow)
                    : "—"
                  : "רשמו"
              }
              detail={
                data.tiles.money.hasIncome ? (
                  data.tiles.money.showSetAside ? (
                    <>הערכה: {nis(data.tiles.money.setAsideLow)}–{nis(data.tiles.money.setAsideHigh)} מההכנסה שנרשמה השנה. מחזור החודש: {nis(data.tiles.money.monthRevenue)}.</>
                  ) : (
                    <>מס חברות מחושב על הרווח — הפרשה מדויקת מול הרו״ח.</>
                  )
                ) : (
                  <>רשמו כמה הכנסתם ותקבלו מיד תחזית הפרשה למיסים ומעקב תקרה.</>
                )
              }
            />
            <OSTile
              href="/tracking"
              icon={<Flame className={`h-4.5 w-4.5 ${data.tiles.streak > 0 ? "text-status-progress" : "text-ink-faint"}`} />}
              label="רצף פעילות"
              value={`${data.tiles.streak}`}
              suffix=" ימים"
              detail={
                data.tiles.streak > 0 ? (
                  <>{data.tiles.streak} ימים ברצף. פעולה אחת היום שומרת על הרצף — אפילו רישום הכנסה או השלמת פרט.</>
                ) : (
                  <>התחילו רצף היום — כל פעולה קטנה נספרת.</>
                )
              }
            />
            <OSTile
              href="/calendar"
              icon={<CalendarClock className="h-4.5 w-4.5 text-brand-400" />}
              label="הדדליין הבא"
              value={data.nextDeadline ? daysShort(data.nextDeadline.daysUntil) : "—"}
              detail={
                data.nextDeadline ? (
                  <>{data.nextDeadline.title} · {data.nextDeadline.date}. חובות סטטוטוריים בלבד נספרים כאן.</>
                ) : (
                  <>אין מועד דחוף באופק הקרוב.</>
                )
              }
            />
            <OSTile
              href="/documents"
              icon={<FolderOpen className="h-4.5 w-4.5 text-brand-400" />}
              label="מסמכים"
              value={`${data.tiles.docsCount}`}
              detail={<>כל המסמכים שהעליתם — תעודות, אישורים וחוזים — במקום אחד ומקושרים למשימות.</>}
            />
            <OSTile
              href="/tasks"
              icon={<CheckCircle2 className="h-4.5 w-4.5 text-status-done" />}
              label="הושלמו"
              value={`${data.tiles.done}`}
              suffix={`/${data.tiles.total}`}
              detail={<>סגרתם {data.tiles.done} מתוך {data.tiles.total} המשימות הרלוונטיות. הפרופיל מלא ב-{data.tiles.profilePercent}%.</>}
            />
          </div>
        </FadeUp>

        {/* ===== recent activity ===== */}
        {data.activity.length > 0 && (
          <FadeUp delay={0.25}>
            <div className="os-card rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-brand-400" aria-hidden />
                <h2 className="text-section text-ink">מה עדכנתם לאחרונה</h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {data.activity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-strong">
                      <Ic name={a.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{a.text}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{a.when}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        )}
      </div>
    </div>
  );
}

/** A glass stat tile that reveals a detail popover on hover (desktop) or tap (mobile). */
function OSTile({
  href,
  icon,
  label,
  value,
  suffix,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  detail: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="group relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="os-card flex min-h-[112px] w-full flex-col justify-between gap-2 p-4 text-start"
      >
        <div className="flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">{icon}</span>
          <ArrowLeft className="h-3.5 w-3.5 text-ink-faint opacity-0 transition group-hover:opacity-100" aria-hidden />
        </div>
        <div>
          <p className="eyebrow">{label}</p>
          <p className="tnum text-2xl font-bold leading-none text-ink">
            {value}
            {suffix && <span className="text-sm font-medium text-ink-muted">{suffix}</span>}
          </p>
        </div>
      </button>

      {/* detail popover */}
      <div
        className={`absolute inset-x-0 top-full z-20 mt-2 rounded-2xl border border-edge-strong bg-card p-3 text-xs leading-relaxed text-ink-soft shadow-xl backdrop-blur-xl transition ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
        }`}
        style={{ backdropFilter: "blur(24px) saturate(1.4)" }}
      >
        {detail}
        <Link href={href} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-strong">
          לפרטים המלאים <ArrowLeft className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function daysShort(d: number): string {
  if (d < 0) return "עבר";
  if (d === 0) return "היום";
  if (d === 1) return "מחר";
  return `${d} ימים`;
}
