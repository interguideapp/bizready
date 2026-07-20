import { YEARLY_FIGURES } from "@/lib/types";
import type { IntegrationCategory, NormalizedBatch } from "./types";

/**
 * The placement engine — the heart of the hub.
 *
 * Pure: given a batch of NEWLY-inserted rows (the caller deduplicates against
 * the DB first, so idempotency is structural) plus the business state, it
 * decides where every datum lands: which tasks get auto-verified, which
 * metrics move, which notifications and compliance errors fire.
 */

export interface ApplyBusiness {
  entity_type: string;
}

export interface ApplyTask {
  id: string;
  template_id: string;
  status: string;
  is_relevant: boolean;
}

export interface ApplyConnection {
  id: string;
  provider: string;
  label: string;
  category: IntegrationCategory;
}

export interface ApplyInput {
  connection: ApplyConnection;
  batch: NormalizedBatch;
  business: ApplyBusiness;
  tasks: ApplyTask[];
  /** Sum of this year's `revenue` metrics BEFORE this batch. */
  ytdRevenueBefore: number;
  today: Date;
}

export interface MetricDelta {
  metric_date: string;
  metric: "revenue" | "documents" | "leads" | "orders" | "payments";
  delta: number;
}

export interface ApplyOutput {
  /** Open tasks to close automatically, with evidence. */
  autoVerify: { taskId: string; templateId: string; note: string }[];
  /** Partial evidence — logged, not closing the task. */
  evidence: { taskId: string; templateId: string; note: string }[];
  metricDeltas: MetricDelta[];
  notifications: {
    type: string;
    title: string;
    body: string | null;
    template_id: string | null;
    dedupe_key: string;
  }[];
  complianceErrors: { code: string; message: string; hint: string | null }[];
}

/** Which open task each connected category verifies automatically. */
const VERIFY_BY_CATEGORY: Partial<Record<IntegrationCategory, string>> = {
  invoicing: "invoicing-software",
  payments: "payment-solution",
  crm: "crm-basic",
};

const ALLOCATION_START = "2026-06-01";
const CEILING_THRESHOLDS = [80, 95, 100] as const;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function applyBatch(input: ApplyInput): ApplyOutput {
  const { connection, batch, business, tasks, today } = input;
  const out: ApplyOutput = {
    autoVerify: [],
    evidence: [],
    metricDeltas: [],
    notifications: [],
    complianceErrors: [],
  };
  const todayIso = isoDay(today);
  const year = today.getUTCFullYear();

  // ---- 1. connection presence verifies the matching task ----
  const openTask = (templateId: string) =>
    tasks.find(
      (t) =>
        t.template_id === templateId &&
        t.is_relevant &&
        t.status !== "done" &&
        t.status !== "not_relevant"
    );

  const verifyTarget = VERIFY_BY_CATEGORY[connection.category];
  if (verifyTarget) {
    const task = openTask(verifyTarget);
    if (task) {
      out.autoVerify.push({
        taskId: task.id,
        templateId: verifyTarget,
        note: `אומת אוטומטית — חיבור פעיל: ${connection.label}`,
      });
    }
  }
  if (connection.category === "ecommerce") {
    const task = openTask("build-website");
    if (task) {
      out.evidence.push({
        taskId: task.id,
        templateId: "build-website",
        note: `זוהתה חנות מחוברת (${connection.label}) — ראיה חלקית`,
      });
    }
  }

  // ---- 2. metrics ----
  const revenueByDay = new Map<string, number>();
  const docsByDay = new Map<string, number>();
  const add = (map: Map<string, number>, day: string, v: number) =>
    map.set(day, (map.get(day) ?? 0) + v);

  const isPaymentsFeed = connection.category === "payments";
  for (const doc of batch.documents) {
    const day = doc.issued_at ?? todayIso;
    if (doc.status === "failed") continue;
    if (doc.kind === "quote") continue;
    const signed = doc.kind === "credit" ? -doc.amount : doc.amount;
    // payments feeds ride a separate metric so a business with both invoicing
    // and clearing connected never double-counts revenue
    add(revenueByDay, day, isPaymentsFeed ? 0 : signed);
    if (isPaymentsFeed) {
      out.metricDeltas.push({ metric_date: day, metric: "payments", delta: signed });
    }
    add(docsByDay, day, 1);
  }
  for (const [day, delta] of revenueByDay) {
    if (delta !== 0)
      out.metricDeltas.push({ metric_date: day, metric: "revenue", delta });
  }
  for (const [day, delta] of docsByDay) {
    out.metricDeltas.push({ metric_date: day, metric: "documents", delta });
  }

  const leadsByDay = new Map<string, number>();
  for (const c of batch.contacts) add(leadsByDay, c.occurred_at ?? todayIso, 1);
  for (const [day, delta] of leadsByDay) {
    out.metricDeltas.push({ metric_date: day, metric: "leads", delta });
  }

  const ordersByDay = new Map<string, number>();
  for (const o of batch.orders) add(ordersByDay, o.placed_at ?? todayIso, o.total);
  for (const [day, delta] of ordersByDay) {
    out.metricDeltas.push({ metric_date: day, metric: "orders", delta });
  }

  // ---- 3. osek patur ceiling watch (real revenue!) ----
  if (business.entity_type === "osek_patur") {
    const revenueDeltaThisYear = out.metricDeltas
      .filter(
        (d) => d.metric === "revenue" && d.metric_date.startsWith(String(year))
      )
      .reduce((sum, d) => sum + d.delta, 0);
    const ytdAfter = input.ytdRevenueBefore + revenueDeltaThisYear;
    const pct = (ytdAfter / YEARLY_FIGURES.osekPaturCeiling) * 100;

    for (const threshold of CEILING_THRESHOLDS) {
      if (pct >= threshold) {
        out.notifications.push({
          type: threshold >= 100 ? "overdue" : "deadline",
          title:
            threshold >= 100
              ? "חצית את תקרת עוסק פטור!"
              : `המחזור הגיע ל-${threshold}% מתקרת עוסק פטור`,
          body: `מחזור שנתי מסונכרן: ₪${Math.round(ytdAfter).toLocaleString()} מתוך ₪${YEARLY_FIGURES.osekPaturCeiling.toLocaleString()}. ${
            threshold >= 100
              ? "חובה לעבור לעוסק מורשה — דברו עם איש מקצוע בהקדם."
              : "הזמן להתחיל לתכנן מעבר לעוסק מורשה."
          }`,
          template_id: "patur-ceiling-watch",
          dedupe_key: `ceiling:${year}:${threshold}`,
        });
      }
    }
  }

  // ---- 4. חשבוניות ישראל — allocation number compliance ----
  if (business.entity_type === "osek_murshe") {
    for (const doc of batch.documents) {
      const isInvoice = doc.kind === "invoice";
      const overThreshold = doc.amount >= YEARLY_FIGURES.invoiceAllocationThreshold;
      const afterStart = (doc.issued_at ?? todayIso) >= ALLOCATION_START;
      if (isInvoice && overThreshold && afterStart && !doc.allocation_number) {
        out.complianceErrors.push({
          code: "missing_allocation",
          message: `חשבונית ${doc.external_id} על ₪${doc.amount.toLocaleString()} ללא מספר הקצאה`,
          hint: doc.external_id,
        });
        out.notifications.push({
          type: "overdue",
          title: "חשבונית ללא מספר הקצאה",
          body: `חשבונית על ₪${doc.amount.toLocaleString()} מעל הסף (₪${YEARLY_FIGURES.invoiceAllocationThreshold.toLocaleString()}) יצאה בלי מספר הקצאה — הלקוח לא יוכל לקזז מע"מ.`,
          template_id: "vat-reporting",
          dedupe_key: `alloc:${doc.external_id}`,
        });
      }
    }
  }

  return out;
}
