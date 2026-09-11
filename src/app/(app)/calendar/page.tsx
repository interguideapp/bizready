import { CalendarClock, ShieldCheck } from "lucide-react";
import { UpgradeCta } from "@/components/upgrade-cta";
import {
  ObligationRow,
  OverdueSection,
  PendingFilingsSection,
  PersonalTargetsSection,
} from "@/components/calendar/sections";
import { Card, EmptyState, FadeIn, PageTitle } from "@/components/ui";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { requireBusinessContext, getBusinessTasks, getDocuments, getFiledPeriods } from "@/lib/data";
import { capabilitiesFor } from "@/lib/members";
import {
  computeUpcomingObligations,
  filingsAwaitingPrerequisite,
  type Obligation,
  type PendingFiling,
} from "@/lib/compliance";
import { isPro } from "@/lib/subscription";
import type { OnboardingAnswers } from "@/lib/types";

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
  const { business, role } = await requireBusinessContext();
  const pro = isPro(business);
  // A viewer's write would be rejected by RLS anyway (022), so offering the
  // control would be offering a button guaranteed to fail.
  const canEdit = capabilitiesFor(role).completeTasks;

  const [tasks, filedPeriods, documents] = await Promise.all([
    getBusinessTasks(business.id),
    getFiledPeriods(business.id),
    getDocuments(business.id),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      dismissal: t.dismissal,
      completion_data: t.completion_data,
        due_date: t.due_date,
        // The filing ledger (030), so EVERY missed period can be named
        // rather than only the oldest one the stored date can reach.
        filed_periods: filedPeriods.get(t.template_id) ?? [],
    })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    {
      entityType: business.entity_type,
      vatFrequency: answers?.vat_frequency,
      hasAccountant: Boolean(business.accountant_name),
    }
  );

  // OVERDUE COMES OUT OF THE TIMELINE.
  //
  // The engine keeps 60 days of overdue history, and grouping everything by
  // month buried a late filing under last month's heading, styled like any
  // other row, at the top of a long scroll. The one thing on this page that
  // costs money every day it is ignored was the easiest thing to miss.
  const overdue = obligations.filter((o) => o.daysUntil < 0);
  const upcoming = obligations.filter((o) => o.daysUntil >= 0);

  // Statutory duties this business has but that have not started, because the
  // setup task unlocking them is unfinished. Without these the board can show
  // nothing at all to a new עוסק and read as "you have no obligations".
  const pendingFilings = filingsAwaitingPrerequisite(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      dismissal: t.dismissal,
      completion_data: t.completion_data,
        due_date: t.due_date,
        // The filing ledger (030), so EVERY missed period can be named
        // rather than only the oldest one the stored date can reach.
        filed_periods: filedPeriods.get(t.template_id) ?? [],
    })),
    TEMPLATES_BY_ID
  );

  // The dates the user set for themselves. Shown as their own thing rather than
  // mixed into the statutory rows, because a target you chose and a date the
  // law fixed are not the same kind of fact.
  const personalTargets = tasks
    .filter((t) => t.is_relevant && t.status !== "done" && t.personal_due_date)
    .map((t) => ({
      templateId: t.template_id,
      title: TEMPLATES_BY_ID.get(t.template_id)?.title ?? t.template_id,
      date: t.personal_due_date as string,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // group the FUTURE by month for the timeline
  const byMonth = new Map<string, Obligation[]>();
  for (const ob of upcoming) {
    const d = new Date(ob.dueDate + "T00:00:00Z");
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const list = byMonth.get(key) ?? [];
    list.push(ob);
    byMonth.set(key, list);
  }

  // The paywall is decided HERE, on the server, before anything is serialised.
  // A free plan gets the nearest month; the rest never reaches the browser, so
  // there is no class to delete and nothing for a screen reader to leak.
  const allMonths = [...byMonth.entries()];
  const visibleMonths = pro ? allMonths : allMonths.slice(0, 1);
  const visibleCount = visibleMonths.reduce((n, [, list]) => n + list.length, 0);
  // The old copy advertised obligations.length — the TOTAL, including the month
  // the user could already see.
  const hiddenCount = upcoming.length - visibleCount;
  const hiddenMonthCount = allMonths.length - visibleMonths.length;

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

      {/* Late first, never behind the paywall: being late is not a premium
          feature, and this is the section the whole page exists for. */}
      <OverdueSection overdue={overdue} canEdit={canEdit} />

      <PendingFilingsSection
        pending={pendingFilings.map((f: PendingFiling) => ({
          templateId: f.templateId,
          title: TEMPLATES_BY_ID.get(f.templateId)?.title ?? f.templateId,
          awaitingId: f.awaiting,
          awaitingTitle: f.awaitingTitle,
        }))}
      />

      <PersonalTargetsSection targets={personalTargets} />

      {obligations.length === 0 && pendingFilings.length === 0 && personalTargets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" aria-hidden />}
            title="אין כרגע חובה עם תאריך"
            subtitle="בדקנו את כל החובות שחלות על העסק שלכם — אין כרגע אחת עם מועד קרוב, ואין אחת שממתינה להתחיל. ברגע שתהיה משימה מחזורית, פוליסה עם חידוש או מסמך עם תפוגה — הכל יופיע כאן לפי תאריך."
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
            {visibleMonths.map(([key, list]) => {
              const [, month] = key.split("-").map(Number);
              const year = Number(key.split("-")[0]);
              return (
                <FadeIn key={key} whenInView>
                  <section>
                    <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink-soft">
                      <span className="rounded-lg bg-brand-tint px-2.5 py-1 text-brand-strong">
                        {MONTHS[month]} {year}
                      </span>
                    </h2>
                    <Card className="divide-y divide-edge-soft">
                      {list.map((ob) => (
                        <ObligationRow key={ob.id} ob={ob} />
                      ))}
                    </Card>
                  </section>
                </FadeIn>
              );
            })}
          </div>

          {/* A real paywall: the gated obligations were never serialised, so
              there is nothing here to un-blur. We say how many and when, which
              is the honest amount of information to give away. */}
          {hiddenCount > 0 && (
            <Card className="mt-4 p-5 text-center">
              <p className="text-sm font-semibold text-ink">
                עוד {hiddenCount} חובות ב-{hiddenMonthCount} החודשים הבאים
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">
                התכנית החינמית מציגה את החודש הקרוב. עם Pro רואים את כל הלוח
                קדימה, עם תזכורות 30, 14, 7 ויום לפני כל מועד.
              </p>
              <div className="mt-4">
                <UpgradeCta compact />
              </div>
            </Card>
          )}
        </>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
        התאריכים מחושבים מלוח הדיווח הרשמי ומותאמים לתדירות הדיווח שלכם (חודשי /
        דו-חודשי — נקבע ב״הגדרות״). ליד כל מועד אפשר לראות בדיוק מאיזה כלל הוא
        נגזר. עדיין — סיווג חריג או ארכת רו״ח יכולים לשנות; ודאו באזור האישי ברשות
        המסים.
      </p>
    </div>
  );
}
