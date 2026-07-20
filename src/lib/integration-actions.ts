"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { executeBatch } from "@/lib/integrations/execute";
import { parseCsvRows, splitCsv } from "@/lib/integrations/parse";
import { PROVIDERS_BY_ID } from "@/lib/integrations/registry";
import { createClient } from "@/lib/supabase/server";

async function requireBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");
  return { supabase, businessId: business.id };
}

/** Creates a connection; api-mode providers are verified before saving. */
export async function createConnection(input: {
  provider: string;
  credentials: Record<string, string>;
  fieldMap: Record<string, boolean>;
  useSecret: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, businessId } = await requireBusiness();
  const adapter = PROVIDERS_BY_ID.get(input.provider);
  if (!adapter) return { ok: false, error: "ספק לא מוכר" };

  if (adapter.mode === "api" && adapter.testConnection) {
    const test = await adapter.testConnection(input.credentials);
    if (!test.ok) {
      return { ok: false, error: `החיבור נכשל: ${test.error ?? "פרטים שגויים"}` };
    }
  }

  const { error } = await supabase.from("integration_connections").insert({
    business_id: businessId,
    provider: adapter.id,
    category: adapter.category,
    mode: adapter.mode,
    credentials: adapter.mode === "api" ? input.credentials : {},
    field_map: input.fieldMap,
    webhook_secret: input.useSecret
      ? randomBytes(24).toString("hex")
      : null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function disconnectConnection(connectionId: string) {
  const { supabase } = await requireBusiness();
  await supabase.from("integration_connections").delete().eq("id", connectionId);
  revalidatePath("/", "layout");
}

/** Manual "sync now" for api-mode connections. */
export async function syncNow(
  connectionId: string
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const { supabase, businessId } = await requireBusiness();

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();
  if (!connection) return { ok: false, error: "חיבור לא נמצא" };

  const adapter = PROVIDERS_BY_ID.get(connection.provider);
  if (!adapter?.pull) return { ok: false, error: "לספק הזה אין סנכרון יזום" };

  try {
    const since = connection.last_sync_at
      ? String(connection.last_sync_at).slice(0, 10)
      : null;
    const batch = await adapter.pull(
      connection.credentials as Record<string, string>,
      since,
      (connection.field_map ?? {}) as Record<string, boolean>
    );
    const result = await executeBatch(
      supabase,
      {
        id: connection.id,
        business_id: businessId,
        provider: connection.provider,
        label: adapter.label,
        category: adapter.category,
      },
      batch
    );
    revalidatePath("/", "layout");
    return { ok: true, inserted: result.inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed";
    await supabase
      .from("integration_connections")
      .update({ status: "error", last_error: message })
      .eq("id", connectionId);
    await supabase.from("sync_errors").insert({
      connection_id: connectionId,
      business_id: businessId,
      code: "sync_failed",
      message,
    });
    revalidatePath("/", "layout");
    return { ok: false, error: message };
  }
}

/** CSV import into an existing csv-mode connection. */
export async function importCsv(
  connectionId: string,
  target: "documents" | "contacts" | "orders",
  csvText: string
): Promise<{ ok: boolean; inserted?: number; rejected?: number; error?: string }> {
  const { supabase, businessId } = await requireBusiness();

  if (csvText.length > 2_000_000) return { ok: false, error: "קובץ גדול מדי (עד 2MB)" };

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, provider, category")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();
  if (!connection) return { ok: false, error: "חיבור לא נמצא" };

  const rows = splitCsv(csvText);
  if (rows.length === 0) return { ok: false, error: "לא נמצאו שורות בקובץ" };

  const { batch, errors } = parseCsvRows(target, rows);
  const adapter = PROVIDERS_BY_ID.get(connection.provider);
  const result = await executeBatch(
    supabase,
    {
      id: connection.id,
      business_id: businessId,
      provider: connection.provider,
      label: adapter?.label ?? connection.provider,
      category: connection.category,
    },
    batch
  );

  revalidatePath("/", "layout");
  return { ok: true, inserted: result.inserted, rejected: errors.length };
}

export async function resolveSyncError(errorId: string) {
  const { supabase } = await requireBusiness();
  await supabase
    .from("sync_errors")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", errorId);
  revalidatePath("/insights");
}
