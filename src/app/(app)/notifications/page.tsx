import { BellOff } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireBusiness } from "@/lib/data";
import { loadAttentionPage } from "@/lib/attention";
import { derivedCount, isGenuinelyCalm } from "@/lib/live-attention";
import { NotificationList } from "./notification-list";
import { SweepNotice } from "./sweep-notice";
import { DeliveryNotice } from "@/components/delivery-notice";
import { deliveryFault, deliveryIsDown, loadDeliveryHealth } from "@/lib/delivery";
import { ChannelsOffNotice } from "@/components/channels-off-notice";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/data";
import { isPro } from "@/lib/subscription";
import { alertHorizon, horizonSentence } from "@/lib/alert-horizon";

/**
 * התראות — derived live, not just read back.
 *
 * This page used to render the `notifications` table and nothing else, and the
 * only writer of deadline/overdue rows is the nightly cron sweep. So whenever
 * that sweep was not running — a missing CRON_SECRET (the routes fail closed on
 * purpose), a platform cron limit, a bad deploy, an exception — the page said
 * "הכל רגוע כרגע" while a statutory filing sat overdue.
 *
 * An all-clear produced by a broken pipeline is the worst thing this product can
 * say. So the page now also runs the same pure engine the sweep runs, against
 * the live task set, and merges the two. What the sweep still uniquely does is
 * SEND (email, push, WhatsApp) and record read state — and where it has not
 * run, the notice at the top says so rather than letting the user assume they
 * were contacted.
 */
export default async function NotificationsPage() {
  const business = await requireBusiness();
  const [page, delivery] = await Promise.all([
    loadAttentionPage(business),
    loadDeliveryHealth(),
  ]);
  const { items, truncated, unreadTruncated } = page;
  const unsent = derivedCount(items);
  const down = deliveryIsDown(delivery);
  /*
   * How far ahead this list actually looked.
   *
   * computeReminders only raises a deadline item once a reminder window is
   * crossed — seven days on the free plan, thirty on Pro — so an empty list
   * means "nothing inside that horizon", not "nothing at all". The empty state
   * used to say "אין דדליין מתקרב", and for a free business with a VAT filing
   * twenty days out that is a clean bill of health the product never checked
   * for. A9 and A2 in one sentence, on the screen whose entire job is that
   * nothing gets missed.
   */
  const horizon = alertHorizon(isPro(business));

  return (
    <div>
      <PageTitle
        title="התראות"
        subtitle="דדליינים, משימות מחזוריות ומה שדורש תשומת לב"
      />

      {/* The heartbeat decides, not the presence of derived items.
          SweepNotice inferred the outage from "some of these were computed
          rather than stored", which could not appear when nothing happened to
          be outstanding and had to hedge about whether sending worked. When the
          heartbeat says nothing is wrong, the derived-items line still has a
          job: those specific items were never sent. */}
      {/* THREE DIFFERENT FACTS, AND SWEEPNOTICE WAS ANSWERING TWO OF THEM.
          Its copy ends "כדאי להיכנס לכאן מדי פעם עד שנוודא שהשליחה האוטומטית
          עובדת" — which is right during an outage and wrong for someone who
          switched their own channels off: sending works, and telling them we
          have machinery to verify sends them to wait for a fix that is not
          coming. The fault names which of the three it is. */}
      {down && delivery ? (
        <DeliveryNotice health={delivery} />
      ) : deliveryFault(delivery) === "opted-out" ? (
        <ChannelsOffNotice />
      ) : (
        unsent > 0 && <SweepNotice count={unsent} />
      )}

      {/* Say when older rows were left off. The cap used to take the fifty most
          RECENT and mention nothing, so an unread overdue from two months ago
          was dropped to make room for recent nudges. Unread now sorts first, so
          this line only ever means "older read history is not shown" — but it
          still has to be said, on the one screen whose job is that nothing gets
          missed. */}
      {truncated && (
        <p className="mb-4 rounded-xl border border-edge bg-surface/60 p-3 text-xs leading-relaxed text-ink-muted">
          {unreadTruncated ? (
            /* The promise below is only true while the unread rows fit. Unread
               sort first, so a read row is always cut before an unread one —
               but past the page size the cut lands inside the unread block,
               and saying "everything unread is here" is then false exactly
               when the list is at its most overwhelming. */
            <>
              יש יותר מ-{NOTIFICATIONS_PAGE_SIZE} התראות שלא נקראו — מוצגות{" "}
              {NOTIFICATIONS_PAGE_SIZE} העדכניות מביניהן. סימון כנקרא יפנה מקום
              לשאר, ולוח החובות מציג בכל מקרה כל חובה עם תאריך.
            </>
          ) : (
            <>
              מוצגות {NOTIFICATIONS_PAGE_SIZE} ההתראות הרלוונטיות ביותר. כל מה
              שלא נקרא מופיע כאן — התראות ישנות שכבר קראתם אינן מוצגות.
            </>
          )}
        </p>
      )}

      {isGenuinelyCalm(items) ? (
        <Card>
          <EmptyState
            icon={<BellOff className="h-6 w-6" aria-hidden />}
            title="אין כרגע מה לטפל"
            subtitle={`בדקנו את המשימות שלכם עכשיו — ${horizonSentence(
              horizon
            )}, אין איחור ואין תקופת דיווח חדשה. מה שרחוק יותר מופיע בלוח החובות לפי תאריך, ונעדכן אותך כאן ברגע שיתקרב.`}
          />
        </Card>
      ) : (
        <NotificationList items={items} />
      )}
    </div>
  );
}
