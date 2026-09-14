import { Suspense } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/app-shell";
import { AttentionBadge } from "@/components/attention-badge";
import { getBusiness } from "@/lib/data";
import { sweepIfScheduleIsDead } from "@/lib/cron/lazy-sweep";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getBusiness();
  if (!business?.onboarding_completed_at) redirect("/onboarding");
  /*
   * THE BADGE IS NO LONGER AWAITED HERE, and that is the whole of the
   * navigation fix.
   *
   * It still counts what is true NOW rather than the stored notifications
   * table — a sweep that had stopped running used to show a badge of zero with
   * a statutory filing overdue, and no badge means no reason to open the page
   * that would have said so. That reasoning is unchanged and lives in
   * AttentionBadge.
   *
   * What changed is when. loadAttentionCount is five Supabase queries plus a
   * reminders computation over every task, and awaiting it here made EVERY
   * navigation in the product wait for one digit on one icon. Behind Suspense
   * the page arrives first and the number follows.
   */

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

  return (
    <AppShell
      notificationsBadge={
        <Suspense fallback={null}>
          <AttentionBadge />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
