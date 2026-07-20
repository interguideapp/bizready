import Link from "next/link";
import {
  BarChart3,
  FileText,
  Gauge,
  TrendingUp,
  Users,
} from "lucide-react";
import { RevenueChart, type MonthPoint } from "@/components/revenue-chart";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import {
  getBusiness,
  getConnections,
  getLeadFunnel,
  getMetrics,
  getOpenSyncErrors,
  getTopCustomers,
} from "@/lib/data";
import { computeForecast } from "@/lib/integrations/forecast";
import { YEARLY_FIGURES } from "@/lib/types";
import { ErrorsList } from "./errors-list";

const STAGE_LABELS: Record<string, string> = {
  lead: "לידים חדשים",
  prospect: "בתהליך",
  customer: "לקוחות",
  lost: "אבודים",
};

export default async function InsightsPage() {
  const business = (await getBusiness())!;
  const now = new Date();
  const yearStart = `${now.getUTCFullYear()}-01-01`;
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  const sinceIso = `${twelveMonthsAgo.toISOString().slice(0, 7)}-01`;

  const [metrics, customers, funnel, errors, connections] = await Promise.all([
    getMetrics(business.id, sinceIso),
    getTopCustomers(business.id),
    getLeadFunnel(business.id),
    getOpenSyncErrors(business.id),
    getConnections(business.id),
  ]);

  const hasData = metrics.length > 0 || connections.length > 0;

  // monthly revenue buckets, oldest → newest
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    points.push({ year: d.getUTCFullYear(), month: d.getUTCMonth(), value: 0 });
  }
  const pointByKey = new Map(points.map((p) => [`${p.year}-${p.month}`, p]));
  let ytd = 0;
  let monthRevenue = 0;
  let monthDocs = 0;
  const thisMonthKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
  for (const m of metrics) {
    const d = new Date(m.metric_date + "T00:00:00Z");
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (m.metric === "revenue") {
      const point = pointByKey.get(key);
      if (point) point.value += m.value;
      if (m.metric_date >= yearStart) ytd += m.value;
      if (key === thisMonthKey) monthRevenue += m.value;
    }
    if (m.metric === "documents" && key === thisMonthKey) monthDocs += m.value;
  }

  const forecast = computeForecast(ytd, now);
  const isPatur = business.entity_type === "osek_patur";
  const openLeads = funnel
    .filter((f) => f.stage === "lead" || f.stage === "prospect")
    .reduce((sum, f) => sum + f.count, 0);

  return (
    <div>
      <PageTitle
        title="תובנות"
        subtitle="המספרים האמיתיים של העסק — מתוך המערכות המחוברות"
      />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" aria-hidden />}
            title="עוד אין נתונים מסונכרנים"
            subtitle="חברו את תוכנת החשבוניות, הסליקה או ה-CRM — והמחזור, הצפי והסטטיסטיקות יופיעו כאן לבד"
            action={
              <Link
                href="/integrations"
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                לחיבור מערכות
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Kpi
              icon={<TrendingUp className="h-4 w-4 text-brand-500" aria-hidden />}
              label="מחזור החודש"
              value={`₪${Math.round(monthRevenue).toLocaleString()}`}
            />
            <Kpi
              icon={<Gauge className="h-4 w-4 text-brand-500" aria-hidden />}
              label={isPatur ? "מחזור שנתי מול תקרה" : "מחזור שנתי"}
              value={`₪${Math.round(ytd).toLocaleString()}`}
              sub={isPatur ? `${forecast.pctOfCeiling}% מהתקרה` : undefined}
              warn={isPatur && forecast.pctOfCeiling >= 80}
            />
            <Kpi
              icon={<FileText className="h-4 w-4 text-brand-500" aria-hidden />}
              label="מסמכים החודש"
              value={String(Math.round(monthDocs))}
            />
            <Kpi
              icon={<Users className="h-4 w-4 text-brand-500" aria-hidden />}
              label="לידים פתוחים"
              value={String(openLeads)}
            />
          </div>

          {/* ceiling progress for patur */}
          {isPatur && ytd > 0 && (
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">תקרת עוסק פטור {now.getUTCFullYear()}</span>
                <span className="text-ink-muted">
                  ₪{Math.round(ytd).toLocaleString()} / ₪
                  {YEARLY_FIGURES.osekPaturCeiling.toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    forecast.pctOfCeiling >= 95
                      ? "bg-status-overdue"
                      : forecast.pctOfCeiling >= 80
                        ? "bg-status-progress"
                        : "bg-brand-600"
                  }`}
                  style={{ width: `${Math.min(100, forecast.pctOfCeiling)}%` }}
                />
              </div>
              {forecast.reliable && (
                <p className="mt-2 text-xs text-ink-muted">
                  צפי לסוף השנה בקצב הנוכחי: ₪
                  {forecast.runRateYearEnd.toLocaleString()} (
                  {forecast.projectedPctOfCeiling}% מהתקרה)
                  {forecast.projectedPctOfCeiling >= 100 &&
                    " — כדאי להתחיל לתכנן מעבר לעוסק מורשה"}
                </p>
              )}
            </Card>
          )}

          {/* revenue chart */}
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-ink">מחזור חודשי</h2>
            <RevenueChart points={points} />
          </Card>

          {/* customers + funnel */}
          <div className="grid gap-4 md:grid-cols-2">
            {customers.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 font-bold text-ink">לקוחות מובילים</h2>
                <ul className="divide-y divide-edge-soft">
                  {customers.map((c) => (
                    <li key={c.customer_name} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {c.customer_name}
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        ₪{Math.round(c.total).toLocaleString()}
                      </span>
                      <span className="text-xs text-ink-muted">({c.count})</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {funnel.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 font-bold text-ink">משפך לידים</h2>
                <ul className="flex flex-col gap-2">
                  {["lead", "prospect", "customer", "lost"]
                    .filter((s) => funnel.some((f) => f.stage === s))
                    .map((stage) => {
                      const count = funnel.find((f) => f.stage === stage)?.count ?? 0;
                      const max = Math.max(...funnel.map((f) => f.count), 1);
                      return (
                        <li key={stage} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-ink-muted">
                            {STAGE_LABELS[stage]}
                          </span>
                          <div className="h-4 flex-1 overflow-hidden rounded-md bg-surface-2">
                            <div
                              className="h-full rounded-md bg-brand-400/75"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-left text-sm font-semibold text-ink">
                            {count}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </Card>
            )}
          </div>

          {/* errors */}
          {errors.length > 0 && <ErrorsList errors={errors} />}

          <p className="text-xs text-ink-faint">
            הנתונים מגיעים מהמערכות שחיברת ב
            <Link href="/integrations" className="text-brand-strong underline">
              מסך האינטגרציות
            </Link>
            . ניהול שוטף של העסק נשאר במערכות המקור.
          </p>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <Card
      className={`flex flex-col gap-0.5 px-3 py-3 ${warn ? "ring-1 ring-status-progress/40" : ""}`}
    >
      <span className="flex items-center gap-1.5 text-lg font-bold text-ink">
        {icon}
        {value}
      </span>
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
      {sub && (
        <span
          className={`text-[11px] font-semibold ${warn ? "text-status-progress" : "text-ink-muted"}`}
        >
          {sub}
        </span>
      )}
    </Card>
  );
}
