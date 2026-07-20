import {
  AlertTriangle,
  CalendarClock,
  FileClock,
  Landmark,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { UpgradeCta } from "@/components/upgrade-cta";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { getBusiness, getBusinessTasks, getDocuments } from "@/lib/data";
import {
  computeUpcomingObligations,
  type Obligation,
  type ObligationKind,
} from "@/lib/compliance";
import { isPro } from "@/lib/subscription";

const KIND_META: Record<
  ObligationKind,
  { label: string; icon: React.ReactNode }
> = {
  vat: { label: "דיווח מע\"מ", icon: <Receipt className="h-4 w-4" aria-hidden /> },
  advances: { label: "מקדמות מס", icon: <Landmark className="h-4 w-4" aria-hidden /> },
  annual_report: {
    label: "דוח שנתי",
    icon: <Landmark className="h-4 w-4" aria-hidden />,
  },
  recurring: {
    label: "משימה מחזורית",
    icon: <RefreshCw className="h-4 w-4" aria-hidden />,
  },
  renewal: { label: "חידוש", icon: <RefreshCw className="h-4 w-4" aria-hidden /> },
  document_expiry: {
    label: "תפוגת מסמך",
    icon: <FileClock className="h-4 w-4" aria-hidden />,
  },
};

const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export default async function CalendarPage() {
  const business = (await getBusiness())!;
  const pro = isPro(business);

  const [tasks, documents] = await Promise.all([
    getBusinessTasks(business.id),
    getDocuments(business.id),
  ]);

  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      completion_data: t.completion_data,
    })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date()
  );

  // group by month for the timeline
  const byMonth = new Map<string, Obligation[]>();
  for (const ob of obligations) {
    const d = new Date(ob.dueDate + "T00:00:00Z");
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const list = byMonth.get(key) ?? [];
    list.push(ob);
    byMonth.set(key, list);
  }

  return (
    <div>
      <PageTitle
        title="לוח החובות"
        subtitle="כל ההגשות, החידושים והתפוגות העתידיים — במקום אחד, לפי תאריך"
      />

      {!pro && (
        <div className="mb-5">
          <UpgradeCta />
        </div>
      )}

      {obligations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" aria-hidden />}
            title="אין חובות עתידיות כרגע"
            subtitle="ברגע שתהיה משימה מחזורית, פוליסה עם תאריך חידוש או מסמך עם תפוגה — הכל יופיע כאן כציר זמן"
          />
        </Card>
      ) : (
        <>
          {pro && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-done/30 bg-status-done-bg/40 px-4 py-2.5 text-sm text-status-done">
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
              <span className="font-medium">
                שומר הדדליינים פעיל — נזכיר לכם 30, 14, 7 ויום לפני כל דדליין
              </span>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {[...byMonth.entries()].map(([key, list]) => {
              const [, month] = key.split("-").map(Number);
              const year = Number(key.split("-")[0]);
              // free users see full first month, the rest blurred behind the paywall
              const isFirst = key === [...byMonth.keys()][0];
              const gated = !pro && !isFirst;
              return (
                <section key={key}>
                  <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink-soft">
                    <span className="rounded-lg bg-brand-tint px-2.5 py-1 text-brand-strong">
                      {MONTHS[month]} {year}
                    </span>
                  </h2>
                  <Card
                    className={`divide-y divide-edge-soft ${gated ? "pointer-events-none select-none blur-sm" : ""}`}
                  >
                    {list.map((ob) => (
                      <ObligationRow key={ob.id} ob={ob} />
                    ))}
                  </Card>
                </section>
              );
            })}
          </div>

          {!pro && byMonth.size > 1 && (
            <p className="mt-4 text-center text-sm text-ink-muted">
              יש עוד {obligations.length} חובות בהמשך — פותחים אותן עם Pro ⬆
            </p>
          )}
        </>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
        מועדים הם הערכה על בסיס כללי המס הרגילים (מע"מ ומקדמות עד ה-15 בחודש
        העוקב, דוח שנתי עד 30.4). מועדים מדויקים תלויים בסיווג שלכם — ודאו מול
        רו"ח או האזור האישי ברשות המסים.
      </p>
    </div>
  );
}

function ObligationRow({ ob }: { ob: Obligation }) {
  const meta = KIND_META[ob.kind];
  const overdue = ob.daysUntil < 0;
  const soon = ob.daysUntil >= 0 && ob.daysUntil <= 7;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          overdue
            ? "bg-status-overdue-bg text-status-overdue"
            : "bg-brand-tint text-brand-strong"
        }`}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{ob.title}</p>
        <p className="text-xs text-ink-muted">{meta.label}</p>
      </div>
      <div className="shrink-0 text-left">
        <p className="text-sm font-semibold text-ink">
          {new Date(ob.dueDate + "T00:00:00").toLocaleDateString("he-IL")}
        </p>
        <p
          className={`text-xs font-medium ${
            overdue
              ? "text-status-overdue"
              : soon
                ? "text-status-progress"
                : "text-ink-muted"
          }`}
        >
          {overdue ? (
            <span className="inline-flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              באיחור
            </span>
          ) : ob.daysUntil === 0 ? (
            "היום"
          ) : (
            `בעוד ${ob.daysUntil} ימים`
          )}
        </p>
      </div>
    </div>
  );
}
