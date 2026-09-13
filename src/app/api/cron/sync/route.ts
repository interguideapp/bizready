import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/supabase/page-all";
import { open } from "@/lib/crypto-box";
import { cronAuthorized } from "@/lib/cron-auth";
import { executeBatch } from "@/lib/integrations/execute";
import { PROVIDERS_BY_ID } from "@/lib/integrations/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginCronRun, endCronRun } from "@/lib/cron-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly pull for all api-mode connections. Wired in vercel.json. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runSyncSweep();
}

/**
 * The work, separated from the HTTP guard.
 *
 * Extracted so it can be run by something other than a cron trigger. With
 * CRON_SECRET unset every /api/cron/* call is rejected — correctly — which
 * meant there was NO way to run the sweep at all, not even for the owner,
 * and the dispatcher's own comment claimed these routes were how a single
 * job gets re-run by hand. They were not. An admin can now run it from
 * /admin, authorized by their session, which is a stronger check than a
 * shared secret rather than a weaker one.
 */
export async function runSyncSweep(): Promise<Response> {
  const supabase = createAdminClient();
  const run = await beginCronRun(supabase, "sync");
  // Paged and ordered, for the same reason as the reminders fan-out: this was
  // an unbounded select whose completeness depended on a PostgREST setting the
  // code never states.
  const { rows: connections, error } = await fetchAllPages((from, to) =>
    supabase
      .from("integration_connections")
      .select("*")
      .eq("mode", "api")
      .neq("status", "disabled")
      .order("id")
      .range(from, to)
  );
  if (error) return NextResponse.json({ error }, { status: 500 });

  let synced = 0;
  let failed = 0;

  for (const connection of connections) {
    const adapter = PROVIDERS_BY_ID.get(connection.provider);
    if (!adapter?.pull) continue;
    try {
      const since = connection.last_sync_at
        ? String(connection.last_sync_at).slice(0, 10)
        : null;
      const batch = await adapter.pull(
        open(connection.credentials),
        since,
        (connection.field_map ?? {}) as Record<string, boolean>
      );
      await executeBatch(
        supabase,
        {
          id: connection.id,
          business_id: connection.business_id,
          provider: connection.provider,
          label: adapter.label,
          category: connection.category,
        },
        batch
      );
      synced++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : "sync failed";
      await supabase
        .from("integration_connections")
        .update({ status: "error", last_error: message })
        .eq("id", connection.id);
      await supabase.from("sync_errors").insert({
        connection_id: connection.id,
        business_id: connection.business_id,
        code: "sync_failed",
        message,
      });
      /*
       * No notification row is written here, deliberately.
       *
       * This used to upsert one keyed `syncfail:<connection>:<date>`, while
       * syncErrorDrafts derives an alert from the very same sync_errors row it
       * just inserted, keyed `sync:<occurred_at>`. mergeAttention dedupes by
       * exact key equality, so the two could never match: ONE broken connection
       * produced TWO rows in the alerts list, under different titles, and at
       * different positions — type "sync" ranks 3 while "system" is unranked
       * and sorts last, so they did not even read as a duplicate.
       *
       * The stored copy was also the worse of the two. getOpenSyncErrors
       * filters on resolved_at, so the derived alert disappears the moment the
       * user resolves the error; a stored row persists until it is READ. Fixing
       * the connection left the alarm standing, which is the same shape as the
       * renewal that could never be cleared.
       *
       * The sync_errors insert above is the durable record, and the alert is
       * derived from it on every page load, so nothing is lost by not storing a
       * second version of the same fact.
       */
    }
  }

  const summary = { ok: true, synced, failed };
  await endCronRun(supabase, run, true, summary);
  return NextResponse.json(summary);
}
