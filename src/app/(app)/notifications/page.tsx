import { BellOff } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireBusiness } from "@/lib/data";
import { loadAttention } from "@/lib/attention";
import { derivedCount, isGenuinelyCalm } from "@/lib/live-attention";
import { NotificationList } from "./notification-list";
import { SweepNotice } from "./sweep-notice";
import { DeliveryNotice } from "@/components/delivery-notice";
import { deliveryIsDown, loadDeliveryHealth } from "@/lib/delivery";

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
  const [items, delivery] = await Promise.all([
    loadAttention(business),
    loadDeliveryHealth(),
  ]);
  const unsent = derivedCount(items);
  const down = deliveryIsDown(delivery);

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
      {down && delivery ? (
        <DeliveryNotice health={delivery} />
      ) : (
        unsent > 0 && <SweepNotice count={unsent} />
      )}

      {isGenuinelyCalm(items) ? (
        <Card>
          <EmptyState
            icon={<BellOff className="h-6 w-6" aria-hidden />}
            title="אין כרגע מה לטפל"
            subtitle="בדקנו את המשימות שלכם עכשיו — אין דדליין מתקרב, אין איחור ואין תקופת דיווח חדשה. נעדכן אותך כאן ברגע שיהיה."
          />
        </Card>
      ) : (
        <NotificationList items={items} />
      )}
    </div>
  );
}
