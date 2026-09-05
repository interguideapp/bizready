import { AlertTriangle, Banknote, CalendarClock, Gauge, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { RevenueChart, type MonthPoint } from "@/components/revenue-chart";
import { computeSetAside } from "@/lib/finance/setaside";

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export interface FinanceData {
  monthly: MonthPoint[];
  entityType: string;
  ceiling: number;
  revenueYtd: number;
  latestMonthRevenue: number;
  monthlyCosts: number;
  nextPayments: { title: string; date: string }[];
}

export function FinancePanels({ d }: { d: FinanceData }) {
  const isPatur = d.entityType === "osek_patur";
  const ceilingPct = Math.min(100, Math.round((d.revenueYtd / d.ceiling) * 100));
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
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full ${ceilingPct >= 100 ? "bg-status-overdue" : ceilingPct >= 80 ? "bg-status-progress" : "bg-gradient-to-l from-brand-600 to-accent-to"}`}
                style={{ width: `${ceilingPct}%` }}
              />
            </div>
            {ceilingPct >= 80 && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-status-progress">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {ceilingPct >= 100 ? "חצית את התקרה — חובה לעבור לעוסק מורשה" : "מתקרבים לתקרה — הזמן לתכנן מעבר לעוסק מורשה"}
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
            הערכה בלבד — כ-25%–35% מהמחזור למס הכנסה וביטוח לאומי.
            {d.entityType === "osek_murshe" && " מע\"מ נגבה מהלקוח ומועבר בנפרד."}
            {" "}לאימות מול רו״ח.
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
