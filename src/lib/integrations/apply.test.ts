import { describe, expect, it } from "vitest";
import { YEARLY_FIGURES } from "@/lib/types";
import { applyBatch, type ApplyInput } from "./apply";
import { computeForecast } from "./forecast";
import { parseWebhookPayload, splitCsv } from "./parse";

const today = new Date("2026-07-20T09:00:00Z");

function baseInput(partial: Partial<ApplyInput> = {}): ApplyInput {
  return {
    connection: {
      id: "conn-1",
      provider: "greeninvoice",
      label: "Green Invoice",
      category: "invoicing",
    },
    batch: { documents: [], contacts: [], orders: [] },
    business: { entity_type: "osek_patur" },
    tasks: [
      { id: "t1", template_id: "invoicing-software", status: "todo", is_relevant: true },
      { id: "t2", template_id: "payment-solution", status: "todo", is_relevant: true },
      { id: "t3", template_id: "crm-basic", status: "todo", is_relevant: true },
    ],
    ytdRevenueBefore: 0,
    today,
    ...partial,
  };
}

describe("applyBatch — auto-verify", () => {
  it("an invoicing connection closes the invoicing task with evidence", () => {
    const out = applyBatch(baseInput());
    expect(out.autoVerify).toHaveLength(1);
    expect(out.autoVerify[0].templateId).toBe("invoicing-software");
    expect(out.autoVerify[0].note).toContain("Green Invoice");
  });

  it("does not re-verify an already-done task", () => {
    const out = applyBatch(
      baseInput({
        tasks: [
          { id: "t1", template_id: "invoicing-software", status: "done", is_relevant: true },
        ],
      })
    );
    expect(out.autoVerify).toHaveLength(0);
  });

  it("a payments connection verifies payment-solution, not invoicing", () => {
    const out = applyBatch(
      baseInput({
        connection: { id: "c", provider: "payments-webhook", label: "סליקה", category: "payments" },
      })
    );
    expect(out.autoVerify.map((v) => v.templateId)).toEqual(["payment-solution"]);
  });

  it("an ecommerce connection only adds partial evidence for the website task", () => {
    const out = applyBatch(
      baseInput({
        connection: { id: "c", provider: "store-webhook", label: "חנות", category: "ecommerce" },
        tasks: [{ id: "t9", template_id: "build-website", status: "todo", is_relevant: true }],
      })
    );
    expect(out.autoVerify).toHaveLength(0);
    expect(out.evidence[0].templateId).toBe("build-website");
  });
});

describe("applyBatch — metrics", () => {
  it("aggregates revenue per day, credits subtract, quotes ignored", () => {
    const out = applyBatch(
      baseInput({
        batch: {
          documents: [
            { external_id: "a", kind: "invoice", amount: 1000, issued_at: "2026-07-01" },
            { external_id: "b", kind: "invoice", amount: 500, issued_at: "2026-07-01" },
            { external_id: "c", kind: "credit", amount: 200, issued_at: "2026-07-02" },
            { external_id: "d", kind: "quote", amount: 9999, issued_at: "2026-07-02" },
          ],
          contacts: [],
          orders: [],
        },
      })
    );
    const revenue = out.metricDeltas.filter((d) => d.metric === "revenue");
    expect(revenue).toEqual([
      { metric_date: "2026-07-01", metric: "revenue", delta: 1500 },
      { metric_date: "2026-07-02", metric: "revenue", delta: -200 },
    ]);
  });

  it("payments-category feeds land in 'payments', never 'revenue' (no double count)", () => {
    const out = applyBatch(
      baseInput({
        connection: { id: "c", provider: "payments-webhook", label: "סליקה", category: "payments" },
        batch: {
          documents: [
            { external_id: "pay-1", kind: "receipt", amount: 350, issued_at: "2026-07-03" },
          ],
          contacts: [],
          orders: [],
        },
      })
    );
    expect(out.metricDeltas.some((d) => d.metric === "revenue")).toBe(false);
    expect(
      out.metricDeltas.find((d) => d.metric === "payments")?.delta
    ).toBe(350);
  });

  it("counts leads and order totals", () => {
    const out = applyBatch(
      baseInput({
        batch: {
          documents: [],
          contacts: [
            { external_id: "l1", occurred_at: "2026-07-10" },
            { external_id: "l2", occurred_at: "2026-07-10" },
          ],
          orders: [{ external_id: "o1", total: 240, placed_at: "2026-07-11" }],
        },
      })
    );
    expect(out.metricDeltas.find((d) => d.metric === "leads")?.delta).toBe(2);
    expect(out.metricDeltas.find((d) => d.metric === "orders")?.delta).toBe(240);
  });
});

describe("applyBatch — patur ceiling", () => {
  it("fires 80% notification when synced revenue crosses the threshold", () => {
    const out = applyBatch(
      baseInput({
        ytdRevenueBefore: YEARLY_FIGURES.osekPaturCeiling * 0.79,
        batch: {
          documents: [
            {
              external_id: "x",
              kind: "invoice",
              amount: YEARLY_FIGURES.osekPaturCeiling * 0.02,
              issued_at: "2026-07-15",
            },
          ],
          contacts: [],
          orders: [],
        },
      })
    );
    const keys = out.notifications.map((n) => n.dedupe_key);
    expect(keys).toContain("ceiling:2026:80");
    expect(keys).not.toContain("ceiling:2026:95");
  });

  it("crossing 100% fires all thresholds (dedupe keys keep it idempotent)", () => {
    const out = applyBatch(
      baseInput({
        ytdRevenueBefore: YEARLY_FIGURES.osekPaturCeiling * 1.01,
      })
    );
    // no new revenue in batch, but state already over — nothing fires without deltas?
    // ceiling check runs regardless of batch content:
    const keys = out.notifications.map((n) => n.dedupe_key);
    expect(keys).toEqual(
      expect.arrayContaining(["ceiling:2026:80", "ceiling:2026:95", "ceiling:2026:100"])
    );
  });

  it("never fires for osek murshe", () => {
    const out = applyBatch(
      baseInput({
        business: { entity_type: "osek_murshe" },
        ytdRevenueBefore: YEARLY_FIGURES.osekPaturCeiling * 2,
      })
    );
    expect(out.notifications.filter((n) => n.dedupe_key.startsWith("ceiling"))).toHaveLength(0);
  });
});

describe("applyBatch — allocation compliance (חשבוניות ישראל)", () => {
  const bigInvoice = {
    external_id: "inv-9",
    kind: "invoice" as const,
    amount: 8000,
    issued_at: "2026-07-01",
    allocation_number: null,
  };

  it("flags a big invoice without allocation number for osek murshe", () => {
    const out = applyBatch(
      baseInput({
        business: { entity_type: "osek_murshe" },
        batch: { documents: [bigInvoice], contacts: [], orders: [] },
      })
    );
    expect(out.complianceErrors[0].code).toBe("missing_allocation");
    expect(out.notifications.some((n) => n.dedupe_key === "alloc:inv-9")).toBe(true);
  });

  it("ignores small invoices, pre-June docs, and patur businesses", () => {
    const cases: ApplyInput[] = [
      baseInput({
        business: { entity_type: "osek_murshe" },
        batch: {
          documents: [{ ...bigInvoice, amount: 4000 }],
          contacts: [],
          orders: [],
        },
      }),
      baseInput({
        business: { entity_type: "osek_murshe" },
        batch: {
          documents: [{ ...bigInvoice, issued_at: "2026-05-01" }],
          contacts: [],
          orders: [],
        },
      }),
      baseInput({
        batch: { documents: [bigInvoice], contacts: [], orders: [] },
      }),
    ];
    for (const input of cases) {
      expect(applyBatch(input).complianceErrors).toHaveLength(0);
    }
  });
});

describe("parseWebhookPayload", () => {
  it("parses a valid document event and clamps strings", () => {
    const { batch, errors } = parseWebhookPayload({
      event: "document.created",
      data: { id: "d1", amount: "1500.5", customer_name: "א".repeat(500) },
    });
    expect(errors).toHaveLength(0);
    expect(batch.documents[0].amount).toBe(1500.5);
    expect(batch.documents[0].customer_name!.length).toBeLessThanOrEqual(200);
  });

  it("rejects junk without throwing", () => {
    const { batch, errors } = parseWebhookPayload({ event: "hack.attempt", data: {} });
    expect(batch.documents).toHaveLength(0);
    expect(errors[0].code).toBe("unknown_event");
  });

  it("maps payment.received onto the receipts rail", () => {
    const { batch } = parseWebhookPayload({
      event: "payment.received",
      data: { id: "p1", amount: 99 },
    });
    expect(batch.documents[0].external_id).toBe("pay-p1");
    expect(batch.documents[0].kind).toBe("receipt");
  });
});

describe("forecast + csv", () => {
  it("projects run-rate to year end", () => {
    // ~mid-year (day 201 of 365): ytd 60k → ~109k projection
    const f = computeForecast(60_000, today);
    expect(f.runRateYearEnd).toBeGreaterThan(100_000);
    expect(f.runRateYearEnd).toBeLessThan(115_000);
    expect(f.reliable).toBe(true);
  });

  it("splits quoted CSV with Hebrew headers", () => {
    const rows = splitCsv('תאריך,סכום,לקוח\n2026-07-01,"1,200",דנה');
    expect(rows).toHaveLength(1);
    expect(rows[0]["לקוח"]).toBe("דנה");
  });

  it('treats mid-field quotes (בע"מ) as literal, not as quoting', () => {
    const rows = splitCsv(
      'date,amount,customer,allocation_number\n2026-07-18,15000,חברת אופק בע"מ,555444333'
    );
    expect(rows[0].customer).toBe('חברת אופק בע"מ');
    expect(rows[0].allocation_number).toBe("555444333");
  });
});
