import { BellOff } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { getBusiness, getNotifications } from "@/lib/data";
import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
  const business = (await getBusiness())!;
  const notifications = await getNotifications(business.id);

  return (
    <div>
      <PageTitle title="התראות" subtitle="דדליינים, משימות מחזוריות ומה שדורש תשומת לב" />
      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff className="h-6 w-6" aria-hidden />}
            title="הכל רגוע כרגע"
            subtitle="נעדכן אותך כאן על דדליינים מתקרבים, משימות באיחור ומשימות מחזוריות שחוזרות"
          />
        </Card>
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  );
}
