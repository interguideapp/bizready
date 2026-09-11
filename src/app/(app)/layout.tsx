import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getBusiness } from "@/lib/data";
import { loadAttentionCount } from "@/lib/attention";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getBusiness();
  if (!business?.onboarding_completed_at) redirect("/onboarding");
  // Not the stored unread count. That read the notifications table alone, so a
  // sweep that had stopped running showed a badge of zero with a statutory
  // filing overdue — and no badge means no reason to open the page that would
  // have said so. This counts what is true now, stored or derived.
  const unread = await loadAttentionCount(business);
  return <AppShell unreadCount={unread}>{children}</AppShell>;
}
