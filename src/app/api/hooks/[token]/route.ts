import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PROVIDERS_BY_ID } from "@/lib/integrations/registry";
import { executeBatch } from "@/lib/integrations/execute";
import { parseWebhookPayload } from "@/lib/integrations/parse";
import { check } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/**
 * The standardized inbound webhook. Any external system (directly or via
 * Make/Zapier) POSTs events here; the per-connection token routes and the
 * optional HMAC secret authenticates.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // cheap sanity + rate limit before touching the DB
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const limit = check(`hook:${token}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, business_id, provider, category, webhook_secret, status")
    .eq("webhook_token", token)
    .maybeSingle();

  if (!connection || connection.status === "disabled") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const rawBody = await request.text();

  // Mandatory HMAC. The token only ROUTES the request; the signature
  // AUTHENTICATES it. The token is shown in the UI, copied to the clipboard and
  // pasted into third-party automation tools, so it cannot also be the
  // credential. This check used to run only "if (connection.webhook_secret)"
  // while the live connect path never set one — so in practice every webhook
  // was unauthenticated, and an inbound payload could inject revenue figures
  // and close compliance tasks.
  if (!connection.webhook_secret) {
    return NextResponse.json(
      { error: "connection has no signing secret - reconnect it" },
      { status: 401 }
    );
  }
  const signature = request.headers.get("x-bizready-signature") ?? "";
  const expected = createHmac("sha256", connection.webhook_secret)
    .update(rawBody)
    .digest("hex");
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { batch, errors } = parseWebhookPayload(payload);

  // record parse problems so the user can see why data didn't land
  for (const err of errors) {
    await supabase.from("sync_errors").insert({
      connection_id: connection.id,
      business_id: connection.business_id,
      code: err.code,
      message: err.message,
    });
  }

  const provider = PROVIDERS_BY_ID.get(connection.provider);
  const result = await executeBatch(
    supabase,
    {
      id: connection.id,
      business_id: connection.business_id,
      provider: connection.provider,
      label: provider?.label ?? connection.provider,
      category: connection.category,
    },
    batch
  );

  return NextResponse.json({
    ok: true,
    accepted: result.inserted,
    rejected: errors.length,
    verified_tasks: result.verified,
  });
}
