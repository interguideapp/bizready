import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getBusiness, getUnreadCount } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getBusiness();
  if (!business?.onboarding_completed_at) redirect("/onboarding");
  const unread = await getUnreadCount(business.id);
  return <AppShell unreadCount={unread}>{children}</AppShell>;
}
