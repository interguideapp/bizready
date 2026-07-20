import { NextResponse } from "next/server";
import { executeBatch } from "@/lib/integrations/execute";
import { PROVIDERS_BY_ID } from "@/lib/integrations/registry";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Nightly pull for all api-mode connections. Wired in vercel.json. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("mode", "api")
    .neq("status", "disabled");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    const adapter = PROVIDERS_BY_ID.get(connection.provider);
    if (!adapter?.pull) continue;
    try {
      const since = connection.last_sync_at
        ? String(connection.last_sync_at).slice(0, 10)
        : null;
      const batch = await adapter.pull(
        connection.credentials as Record<string, string>,
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
      await supabase.from("notifications").upsert(
        [
          {
            business_id: connection.business_id,
            type: "system",
            title: `סנכרון ${adapter.label} נכשל`,
            body: "בדקו את פרטי החיבור במסך האינטגרציות.",
            template_id: null,
            dedupe_key: `syncfail:${connection.id}:${new Date().toISOString().slice(0, 10)}`,
          },
        ],
        { onConflict: "business_id,dedupe_key", ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.json({ ok: true, synced, failed });
}
