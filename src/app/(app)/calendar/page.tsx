import { CalendarClock, ShieldCheck } from "lucide-react";
import { ChannelsOffNotice } from "@/components/channels-off-notice";
import { DeliveryNotice } from "@/components/delivery-notice";
import {
  deliveryFault,
  deliveryIsDown,
  loadDeliveryHealth,
  remindersWillReach,
} from "@/lib/delivery";
import { loadLiveTasks } from "@/lib/tasks-live";
import { UpgradeCta } from "@/components/upgrade-cta";
import {
  ObligationRow,
  BlockedFilingsSection,
  hiddenObligationsText,
  LapsedSection,
  OverdueSection,
  PendingFilingsSection,
  PersonalTargetsSection,
} from "@/components/calendar/sections";
import { Card, EmptyState, FadeIn, PageTitle } from "@/components/ui";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { requireBusinessContext, getDocuments, getFiledPeriods } from "@/lib/data";
import { capabilitiesFor } from "@/lib/members";
import {
  alreadyPast,
  computeUpcomingObligations,
  overdueStatutory,
  filingsAwaitingPrerequisite,
  filingsBlockedByDismissal,
  stillAhead,
  type PendingFiling,
} from "@/lib/compliance";
import { isPro } from "@/lib/subscription";
import { boardWindow } from "@/lib/board-window";
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

  const [tasks, filedPeriods, documents, delivery] = await Promise.all([
    loadLiveTasks(business),
    getFiledPeriods(business.id),
    getDocuments(business.id),
    loadDeliveryHealth(),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      completed_at: t.completed_at,
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
  // A LAPSED COVER IS NOT AN INTEREST-BEARING DEBT.
  //
  // Everything past its date used to go into one group, under a heading reading
  // "חובות עברו את המועד" and the line "איחור בדיווח או בתשלום צובר ריבית
  // והצמדה מהיום הראשון". True of a VAT period. Not true of an expired
  // professional-liability policy: no authority charges interest on it, and for
  // most professions it is not a legal duty at all — the template was
  // deliberately re-tiered away from "critical" for exactly that reason.
  //
  // Overclaiming legal consequence is the one thing this product must never do,
  // so the two kinds of late are separated by basis and each gets the
  // consequence that is actually its own.
  // The same split insights now uses, rather than a second copy of the
  // comparison: the two screens disagreeing about what "קרוב" means is the
  // failure this consolidation exists to prevent.
  const pastDue = alreadyPast(obligations);
  const overdue = overdueStatutory(obligations);
  const lapsed = pastDue.filter((o) => o.basis !== "statutory");
  const upcoming = stillAhead(obligations);

  // Statutory duties this business has but that have not started, because the
  // setup task unlocking them is unfinished. Without these the board can show
  // nothing at all to a new עוסק and read as "you have no obligations".
  // Statutory duties whose prerequisite the user set aside. Named on the board
  // too, not only on Home: fixing the message these used to get must not turn
  // into silence about the duty itself.
  const blockedFilings = filingsBlockedByDismissal(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      completed_at: t.completed_at,
      is_relevant: t.is_relevant,
      dismissal: t.dismissal,
      completion_data: t.completion_data,
      due_date: t.due_date,
      filed_periods: filedPeriods.get(t.template_id) ?? [],
    })),
    TEMPLATES_BY_ID
  );

  const pendingFilings = filingsAwaitingPrerequisite(
    tasks.map((t) => ({
      template_id: t.template_id,
      status: t.status,
      completed_at: t.completed_at,
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

  // The paywall is decided on the SERVER, before anything is serialised: a
  // free plan gets the nearest month and the rest never reaches the browser,
  // so there is no class to delete and nothing for a screen reader to leak.
  //
  // Moved into lib/board-window.ts because /insights was rendering the same
  // obligations, across any month, with no tier check at all — the gated data
  // leaving by a second door, which made this gate theatre. One decision, two
  // callers.
  const window = boardWindow(upcoming, pro);
  const visibleMonths = window.months;
  // Never obligations.length: the month the user can already see is not hidden.
  const hiddenCount = window.hiddenCount;
  const hiddenMonthCount = window.hiddenMonthCount;

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

      {/* A user who lives on this page and never opens /notifications would
          otherwise keep waiting for an email that is not coming. */}
      {deliveryIsDown(delivery) && <DeliveryNotice health={delivery} compact />}

      {/* Late first, never behind the paywall: being late is not a premium
          feature, and this is the section the whole page exists for. */}
      <OverdueSection overdue={overdue} canEdit={canEdit} />

      {/* Cover that has run out — a different consequence, said differently. */}
      <LapsedSection lapsed={lapsed} />

      <BlockedFilingsSection
        blocked={blockedFilings.map((f) => ({
          templateId: f.templateId,
          title: TEMPLATES_BY_ID.get(f.templateId)?.title ?? f.templateId,
          blockedById: f.blockedBy,
          blockedByTitle: TEMPLATES_BY_ID.get(f.blockedBy)?.title ?? f.blockedBy,
        }))}
      />

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
          {/* A CONTRADICTION I CREATED. DeliveryNotice sits at the top of this
              page when outbound is down, and this banner sat below it claiming
              "שומר הדדליינים פעיל" — two statements about the same mechanism,
              opposite, on one screen. The claim is only true while the sweep
              is actually running, so it is made only then. */}
          {/* A SECOND CONTRADICTION, inside the fix for the first.
              !deliveryIsDown is the absence of a KNOWN fault, and this banner
              needs the presence of delivery. Both live businesses had push
              switched off and zero subscribed devices, so setting the VAPID
              keys and nothing else would have emptied the fault list and put
              this green banner back on screen with nothing able to reach them.
              remindersWillReach demands the positive answer instead. */}
          {pro && remindersWillReach(delivery) && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-done/30 bg-status-done-bg/40 px-4 py-2.5 text-sm text-status-done">
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
              <span className="font-medium">
                שומר הדדליינים פעיל — נזכיר לכם 30, 14, 7 ויום לפני כל חובה
                והגשה
              </span>
            </div>
          )}

          {/* The channels are the user's own, and switching them off is a
              legitimate choice — so this is not an alarm and does not use
              DeliveryNotice. It exists because the alternative is silence:
              someone who turned email off months ago has no way to know the
              reminders they are counting on are not coming. One line, with the
              switch one tap away. */}
          {deliveryFault(delivery) === "opted-out" && <ChannelsOffNotice compact />}

          <div className="flex flex-col gap-6">
            {/* year and month come off the group, not off a re-parsed key
                string — the key was 0-based and unpadded, so any future sort
                of these entries would have ordered October before September. */}
            {visibleMonths.map((group) => (
              <FadeIn key={group.key} whenInView>
                <section>
                  <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink-soft">
                    <span className="rounded-lg bg-brand-tint px-2.5 py-1 text-brand-strong">
                      {MONTHS[group.month]} {group.year}
                    </span>
                  </h2>
                  <Card className="divide-y divide-edge-soft">
                    {group.items.map((ob) => (
                      <ObligationRow key={ob.id} ob={ob} />
                    ))}
                  </Card>
                </section>
              </FadeIn>
            ))}
          </div>

          {/* A real paywall: the gated obligations were never serialised, so
              there is nothing here to un-blur. We say how many and when, which
              is the honest amount of information to give away. */}
          {hiddenCount > 0 && (
            <Card className="mt-4 p-5 text-center">
              <p className="text-sm font-semibold text-ink">
                {hiddenObligationsText(hiddenCount, hiddenMonthCount)}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">
                התכנית החינמית מציגה את החודש הקרוב. עם Pro רואים את כל הלוח
                קדימה, עם תזכורות 30, 14, 7 ויום לפני כל חובה והגשה.
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
