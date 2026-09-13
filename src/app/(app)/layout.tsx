import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/app-shell";
import { getBusiness } from "@/lib/data";
import { loadAttentionCount } from "@/lib/attention";
import { sweepIfScheduleIsDead } from "@/lib/cron/lazy-sweep";

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

  // THE OUTBOUND FALLBACK.
  //
  // Every reminder comes from a cron trigger, and that trigger is the one part
  // of the system that cannot be fixed from the codebase: Vercel only sends the
  // authorization header when CRON_SECRET is set. So the product's promise to
  // contact people was hostage to one environment variable.
  //
  // after() runs this once the response has already gone out, so it costs the
  // reader nothing, and it disables itself the moment a real cron is healthy —
  // the heartbeat is the gate. See lib/cron/lazy-sweep.ts for what it
  // deliberately does NOT solve.
  after(sweepIfScheduleIsDead);

  return <AppShell unreadCount={unread}>{children}</AppShell>;
}
