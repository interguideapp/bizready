import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobsDue } from "@/lib/cron/due";
import type { SweepJob, SweepRun } from "@/lib/heartbeat";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET as runReminders } from "../reminders/route";
import { GET as runRetention } from "../retention/route";
import { GET as runSourceWatch } from "../source-watch/route";
import { GET as runSync } from "../sync/route";

export const dynamic = "force-dynamic";
// Hobby's ceiling. `sync` asked for 300, which this plan cannot grant, so the
// budget below is what actually keeps the invocation inside its limit.
export const maxDuration = 60;

/**
 * The one scheduled invocation this plan allows.
 *
 * vercel.json declared four cron entries. The account is on the **Hobby**
 * plan, which permits a maximum of TWO cron jobs per project — so the
 * configuration was invalid, and three days of grouped runtime logs showed not
 * one `/api/cron/*` request arriving. Every email, push and WhatsApp this
 * product sends comes from that sweep, so none of them were being sent.
 *
 * This is the fix that does not need a paid plan: one daily entry, which asks
 * the heartbeat what is due and runs it. Four jobs, one slot, two to spare.
 *
 * The individual routes are KEPT and still authorized separately — they are how
 * a single job is re-run by hand after a failure, and they own their own
 * heartbeat rows, so nothing here needs to know what any of them does.
 */

const RUNNERS: Record<SweepJob, (request: Request) => Promise<Response>> = {
  reminders: runReminders,
  retention: runRetention,
  sync: runSync,
  "source-watch": runSourceWatch,
};

/**
 * Stop starting new jobs once this much of the window is gone.
 *
 * A job killed halfway through is worse than a job that runs tomorrow: the
 * heartbeat would record neither success nor failure, and a half-applied
 * retention sweep is a legal record with a hole in it. Anything not started
 * stays due — jobsDue reads the heartbeat, so it is still true next time.
 */
const BUDGET_MS = 40_000;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const supabase = createAdminClient();

  // Read through the security-definer summary, the same way /admin does, rather
  // than touching cron_runs directly.
  const { data: health } = await supabase.rpc("sweep_health");
  const runs: SweepRun[] = (
    (health ?? []) as { job: string; last_ok_at: string | null; last_failed_at: string | null }[]
  ).map((r) => ({
    job: r.job as SweepJob,
    lastOkAt: r.last_ok_at,
    lastFailedAt: r.last_failed_at,
  }));

  const due = jobsDue(runs, new Date().toISOString());
  const ran: { job: SweepJob; status: number }[] = [];
  const skipped: SweepJob[] = [];

  for (const job of due) {
    if (Date.now() - started > BUDGET_MS) {
      skipped.push(job);
      continue;
    }
    try {
      const res = await RUNNERS[job](request);
      ran.push({ job, status: res.status });
    } catch (e) {
      // One job failing must not stop the rest — reminders running is not
      // contingent on source-watch being reachable. The job's own route
      // records its failure in the heartbeat before it throws.
      ran.push({ job, status: 500 });
      console.error(`[cron/daily] ${job} threw`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    due,
    ran,
    skipped,
    elapsedMs: Date.now() - started,
  });
}
