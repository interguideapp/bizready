import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBatch, type ApplyConnection } from "./apply";
import type { NormalizedBatch } from "./types";

/**
 * Persists a normalized batch and executes the placement engine's decisions.
 *
 * Idempotency is structural: rows are upserted with ignoreDuplicates and only
 * the rows the DB actually accepted (i.e. genuinely new) feed the engine, so
 * replaying a webhook or re-pulling a provider never double-counts metrics or
 * re-fires effects.
 */
export async function executeBatch(
  supabase: SupabaseClient,
  connection: ApplyConnection & { business_id: string },
  batch: NormalizedBatch
): Promise<{ inserted: number; verified: string[]; alerts: number }> {
  const businessId = connection.business_id;

  // ---- 1. persist, keeping only genuinely-new rows ----
  const newBatch: NormalizedBatch = { documents: [], contacts: [], orders: [] };

  if (batch.documents.length > 0) {
    const { data } = await supabase
      .from("synced_documents")
      .upsert(
        batch.documents.map((d) => ({
          connection_id: connection.id,
          business_id: businessId,
          external_id: d.external_id,
          kind: d.kind,
          amount: d.amount,
          vat_amount: d.vat_amount ?? null,
          currency: d.currency ?? "ILS",
          issued_at: d.issued_at ?? null,
          customer_name: d.customer_name ?? null,
          allocation_number: d.allocation_number ?? null,
          status: d.status ?? null,
          extra: d.extra ?? {},
        })),
        { onConflict: "connection_id,external_id", ignoreDuplicates: true }
      )
      .select("external_id");
    const newIds = new Set((data ?? []).map((r) => r.external_id));
    newBatch.documents = batch.documents.filter((d) => newIds.has(d.external_id));
  }

  if (batch.contacts.length > 0) {
    const { data } = await supabase
      .from("synced_contacts")
      .upsert(
        batch.contacts.map((c) => ({
          connection_id: connection.id,
          business_id: businessId,
          external_id: c.external_id,
          name: c.name ?? null,
          stage: c.stage ?? "lead",
          source: c.source ?? null,
          value: c.value ?? null,
          occurred_at: c.occurred_at ?? null,
        })),
        { onConflict: "connection_id,external_id", ignoreDuplicates: true }
      )
      .select("external_id");
    const newIds = new Set((data ?? []).map((r) => r.external_id));
    newBatch.contacts = batch.contacts.filter((c) => newIds.has(c.external_id));
  }

  if (batch.orders.length > 0) {
    const { data } = await supabase
      .from("synced_orders")
      .upsert(
        batch.orders.map((o) => ({
          connection_id: connection.id,
          business_id: businessId,
          external_id: o.external_id,
          total: o.total,
          status: o.status ?? null,
          items_count: o.items_count ?? null,
          placed_at: o.placed_at ?? null,
        })),
        { onConflict: "connection_id,external_id", ignoreDuplicates: true }
      )
      .select("external_id");
    const newIds = new Set((data ?? []).map((r) => r.external_id));
    newBatch.orders = batch.orders.filter((o) => newIds.has(o.external_id));
  }

  // ---- 2. business state for the engine ----
  const [{ data: business }, { data: tasks }, { data: metrics }] = await Promise.all([
    supabase.from("businesses").select("entity_type").eq("id", businessId).single(),
    supabase
      .from("business_tasks")
      .select("id, template_id, status, is_relevant")
      .eq("business_id", businessId),
    supabase
      .from("sync_metrics")
      .select("value")
      .eq("business_id", businessId)
      .eq("metric", "revenue")
      .gte("metric_date", `${new Date().getUTCFullYear()}-01-01`),
  ]);

  const ytdRevenueBefore = (metrics ?? []).reduce(
    (sum, m) => sum + Number(m.value),
    0
  );

  const out = applyBatch({
    connection,
    batch: newBatch,
    business: { entity_type: business?.entity_type ?? "osek_patur" },
    tasks: tasks ?? [],
    ytdRevenueBefore,
    today: new Date(),
  });

  // ---- 3. execute effects ----

  // metrics: read-modify-write per (date, metric)
  for (const delta of out.metricDeltas) {
    const { data: existing } = await supabase
      .from("sync_metrics")
      .select("id, value")
      .eq("business_id", businessId)
      .eq("metric_date", delta.metric_date)
      .eq("metric", delta.metric)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("sync_metrics")
        .update({ value: Number(existing.value) + delta.delta })
        .eq("id", existing.id);
    } else {
      await supabase.from("sync_metrics").insert({
        business_id: businessId,
        metric_date: delta.metric_date,
        metric: delta.metric,
        value: delta.delta,
        category: connection.category,
      });
    }
  }

  // auto-verified tasks — close with evidence + activity event
  for (const verify of out.autoVerify) {
    await supabase
      .from("business_tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completion_data: { auto: "true", note: verify.note },
      })
      .eq("id", verify.taskId);
    await supabase.from("task_events").insert({
      business_id: businessId,
      task_id: verify.taskId,
      template_id: verify.templateId,
      kind: "auto_verified",
      to_status: "done",
      detail: verify.note,
    });
  }
  for (const ev of out.evidence) {
    await supabase.from("task_events").insert({
      business_id: businessId,
      task_id: ev.taskId,
      template_id: ev.templateId,
      kind: "note",
      detail: ev.note,
    });
  }

  // notifications (dedupe via unique constraint)
  if (out.notifications.length > 0) {
    await supabase.from("notifications").upsert(
      out.notifications.map((n) => ({ ...n, business_id: businessId })),
      { onConflict: "business_id,dedupe_key", ignoreDuplicates: true }
    );
  }

  // compliance errors — skip if an unresolved twin exists
  for (const err of out.complianceErrors) {
    const { data: twin } = await supabase
      .from("sync_errors")
      .select("id")
      .eq("business_id", businessId)
      .eq("code", err.code)
      .eq("hint", err.hint)
      .is("resolved_at", null)
      .maybeSingle();
    if (!twin) {
      await supabase.from("sync_errors").insert({
        connection_id: connection.id,
        business_id: businessId,
        code: err.code,
        message: err.message,
        hint: err.hint,
      });
    }
  }

  // connection heartbeat
  await supabase
    .from("integration_connections")
    .update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null })
    .eq("id", connection.id);

  return {
    inserted:
      newBatch.documents.length + newBatch.contacts.length + newBatch.orders.length,
    verified: out.autoVerify.map((v) => v.templateId),
    alerts: out.notifications.length + out.complianceErrors.length,
  };
}
