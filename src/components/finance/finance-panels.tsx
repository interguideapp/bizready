import { AlertTriangle, Banknote, CalendarClock, Gauge, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { RevenueChart, type MonthPoint } from "@/components/revenue-chart";
import { ceilingOutlook, ceilingStanding, revenueCoverage } from "@/lib/finance/ceiling";
import { formatHeDate } from "@/lib/dates";
import { computeForecast } from "@/lib/integrations/forecast";
import { SETASIDE_ESTIMATE_NOTE, computeSetAside } from "@/lib/finance/setaside";
import { formatIlsRounded } from "@/lib/money";

// One formatter for the whole app — see lib/money.ts. Rounded here because
// these are aggregates and chart labels, where agorot are noise.
const nis = formatIlsRounded;

export interface FinanceData {
  monthly: MonthPoint[];
  entityType: string;
  ceiling: number;
  revenueYtd: number;
  /**
   * The latest month the revenue figures actually cover, as yyyy-mm.
   *
   * The ceiling decides a legal fact and its percentage was rendered with no
   * indication of the data's age, while the nightly sync that fills those
   * figures has no fallback. A business genuinely over the ceiling could read
   * 78% off three-month-old data and conclude it had room.
   */
  revenueThroughMonth: string | null;
  todayIso: string;
  latestMonthRevenue: number;
  monthlyCosts: number;
  nextPayments: { title: string; date: string }[];
}

export function FinancePanels({ d }: { d: FinanceData }) {
  const isPatur = d.entityType === "osek_patur";
  // The STATE comes from the real figures; pct is only the bar's width. It used
  // to be the other way round, and Math.round turned ₪122,500 against a
  // ₪122,833 ceiling into "you have crossed it, you must change status".
  const ceiling = ceilingStanding(d.revenueYtd, d.ceiling);
  const ceilingPct = ceiling.pct;
  // YTD against the ceiling is a LAGGING indicator: 60% in June is "ok" and
  // crosses in September at the same run rate. computeForecast has produced
  // this projection all along, tested, and nothing ever called it.
  const forecast = computeForecast(d.revenueYtd, new Date());
  const outlook = ceilingOutlook({
    state: ceiling.state,
    ceiling: d.ceiling,
    projectedYearEnd: forecast.runRateYearEnd,
    reliable: forecast.reliable,
  });
  const coverage = revenueCoverage(d.revenueThroughMonth, d.todayIso);
  const net = d.latestMonthRevenue - d.monthlyCosts;
  const setAside = computeSetAside(d.revenueYtd);

  return (
    <div className="flex flex-col gap-3">
      {/* revenue + ceiling */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-section text-ink">
            <TrendingUp className="h-4.5 w-4.5 text-brand-400" aria-hidden />
            מחזור — 12 חודשים
          </h2>
          <span className="tnum text-sm text-ink-muted">
            השנה <b className="text-ink">{nis(d.revenueYtd)}</b>
          </span>
        </div>
        <RevenueChart points={d.monthly} />
        {isPatur && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <Gauge className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                תקרת עוסק פטור
              </span>
              <span className="tnum text-ink-muted">{nis(d.revenueYtd)} / {nis(d.ceiling)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full ${ceiling.state === "crossed" ? "bg-status-overdue" : ceiling.state === "approaching" ? "bg-status-progress" : "bg-gradient-to-l from-brand-600 to-accent-to"}`}
                style={{ width: `${ceilingPct}%` }}
              />
            </div>
            {/* WHERE THIS PERCENTAGE COMES FROM.
                A number that decides whether someone must register for מע״מ
                must not be read as current when it is not. Said plainly when
                the data is behind, and quietly when it is not — a provenance
                line that shouts every month becomes wallpaper. */}
            {coverage?.behind && d.revenueThroughMonth && (
              <p
                role="status"
                className="mt-2 flex items-start gap-1.5 rounded-lg border border-status-progress/40 bg-status-progress/5 px-2.5 py-2 text-xs leading-relaxed text-ink"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-progress"
                  aria-hidden
                />
                <span>
                  המספר הזה מבוסס על מחזור עד{" "}
                  {formatHeDate(d.revenueThroughMonth + "-01")} בלבד
                  {coverage.monthsBehind >= 2
                    ? ` — חסרים ${coverage.monthsBehind - 1 === 1 ? "חודש" : `${coverage.monthsBehind - 1} חודשים`}`
                    : ""}
                  . האחוז אמיתי רק ביחס למה שנרשם, ולכן ייתכן שאתם גבוהים יותר.
                  כדאי לסנכרן או לרשום את ההכנסות החסרות.
                </span>
              </p>
            )}
            {!coverage?.behind && d.revenueThroughMonth && (
              <p className="mt-1.5 text-xs text-ink-muted">
                מבוסס על מחזור עד {formatHeDate(d.revenueThroughMonth + "-01")}.
              </p>
            )}
            {/* On course to cross, though not there yet. Stated as a
                projection, never as a breach — ceiling.state remains the only
                thing that says something has actually happened. */}
            {outlook === "projected_cross" && (
              <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-status-progress">
                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  בקצב הנוכחי המחזור השנתי צפוי להגיע לכ-{nis(forecast.runRateYearEnd)} —
                  מעל התקרה. זו תחזית לפי הקצב עד כה, לא קביעה; מעבר לעוסק מורשה
                  לוקח זמן, ולכן כדאי לבדוק את זה עכשיו ולא כשהמספר בפועל יגיע.
                </span>
              </p>
            )}
            {ceiling.state !== "ok" && (
              <p
                className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
                  ceiling.state === "crossed" ? "text-status-overdue" : "text-status-progress"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {ceiling.state === "crossed"
                  ? "חרגתם מהתקרה — חובה לעבור לעוסק מורשה"
                  : "מתקרבים לתקרה — הזמן לתכנן מעבר לעוסק מורשה"}
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* income vs expense */}
        <Card className="h-full p-5">
          <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
            <Banknote className="h-4.5 w-4.5 text-brand-400" aria-hidden />
            הכנסות מול הוצאות
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <Row label="מחזור החודש" value={nis(d.latestMonthRevenue)} />
            <Row label="הוצאות קבועות (חודשי)" value={nis(d.monthlyCosts)} />
            <div className="mt-1 flex items-center justify-between border-t border-edge pt-2">
              <span className="font-semibold text-ink">נטו משוער</span>
              <span className={`tnum font-bold ${net >= 0 ? "text-status-done" : "text-status-overdue"}`}>{nis(net)}</span>
            </div>
          </div>
        </Card>

        {/* tax set-aside */}
        <Card className="h-full p-5">
          <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
            <CalendarClock className="h-4.5 w-4.5 text-brand-400" aria-hidden />
            כמה להפריש למיסים
          </h2>
          <p className="tnum text-2xl font-bold text-ink">{nis(setAside.low)}–{nis(setAside.high)}</p>
          <p className="text-xs text-ink-muted">
            {SETASIDE_ESTIMATE_NOTE} כ-25%–35% מהמחזור למס הכנסה וביטוח לאומי.
            {(d.entityType === "osek_murshe" || d.entityType === "company") && " מע״מ נגבה מהלקוח ומועבר בנפרד."}
          </p>
          {d.nextPayments.length > 0 && (
            <div className="mt-3 border-t border-edge-soft pt-3">
              <p className="eyebrow mb-2">תשלומים קרובים</p>
              <div className="flex flex-col gap-1.5">
                {d.nextPayments.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink-soft">{p.title}</span>
                    <span className="tnum shrink-0 text-xs font-semibold text-ink">{p.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum font-semibold text-ink">{value}</span>
    </div>
  );
}
