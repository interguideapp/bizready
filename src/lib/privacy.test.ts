import { describe, expect, it } from "vitest";
import {
  SYNCED_DATA_RETENTION_DAYS,
  buildDataExport,
  maskAccount,
  retentionCutoff,
  type DataExport,
} from "./privacy";

/** A tiny stand-in for the Supabase query builder shape buildDataExport uses. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; column: string; value: string }[] = [];
  return {
    calls,
    client: {
      from: (table: string) => ({
        select: (_cols: string) => ({
          eq: async (column: string, value: string) => {
            calls.push({ table, column, value });
            const rows = (tables[table] ?? []).filter((r) => r[column] === value);
            return { data: rows, error: null };
          },
        }),
      }),
    },
  };
}

const BUSINESS_ID = "biz-1";
const USER_ID = "user-1";

function seed() {
  return {
    businesses: [{ id: BUSINESS_ID, name: "עסק לדוגמה", bank_account: "12345" }],
    business_tasks: [{ id: "t1", business_id: BUSINESS_ID, template_id: "open-vat-file" }],
    task_events: [{ id: "e1", business_id: BUSINESS_ID, kind: "completed" }],
    documents: [{ id: "d1", business_id: BUSINESS_ID, name: "תעודת עוסק" }],
    task_checklist_items: [{ id: "c1", business_id: BUSINESS_ID, label: "x" }],
    business_products: [{ id: "p1", business_id: BUSINESS_ID, name: "שירות" }],
    business_costs: [{ id: "k1", business_id: BUSINESS_ID, name: "תוכנה" }],
    notifications: [{ id: "n1", business_id: BUSINESS_ID, title: "תזכורת" }],
    integration_connections: [
      {
        id: "i1",
        business_id: BUSINESS_ID,
        provider: "icount",
        credentials: { v: 1, ct: "sealed-blob" },
        webhook_secret: "super-secret",
        webhook_token: "tok_123",
      },
    ],
    synced_documents: [{ id: "s1", business_id: BUSINESS_ID, customer_name: "לקוח א" }],
    synced_contacts: [{ id: "s2", business_id: BUSINESS_ID, name: "איש קשר" }],
    synced_orders: [{ id: "s3", business_id: BUSINESS_ID, total: 100 }],
    sync_metrics: [{ id: "s4", business_id: BUSINESS_ID, metric: "revenue", value: 5000 }],
  };
}

async function exportFor(businessId: string | null): Promise<DataExport> {
  const db = fakeDb(seed());
  return buildDataExport(db.client, {
    userId: USER_ID,
    email: "owner@example.com",
    businessId,
  });
}

describe("buildDataExport", () => {
  it("includes every table the product stores for a business", async () => {
    const out = await exportFor(BUSINESS_ID);
    expect(out.business).toMatchObject({ id: BUSINESS_ID });
    expect(out.tasks).toHaveLength(1);
    expect(out.taskEvents).toHaveLength(1);
    expect(out.documents).toHaveLength(1);
    expect(out.checklistItems).toHaveLength(1);
    expect(out.products).toHaveLength(1);
    expect(out.costs).toHaveLength(1);
    expect(out.notifications).toHaveLength(1);
    expect(out.integrations).toHaveLength(1);
  });

  it("includes the user's OWN customers' data — they are the controller of it", async () => {
    // An export that omitted these would not let a business owner answer their
    // own customers' access requests, which is the duty the product's privacy
    // task tells them they have.
    const out = await exportFor(BUSINESS_ID);
    expect(out.syncedDocuments[0]).toMatchObject({ customer_name: "לקוח א" });
    expect(out.syncedContacts[0]).toMatchObject({ name: "איש קשר" });
    expect(out.syncedOrders).toHaveLength(1);
    expect(out.syncMetrics).toHaveLength(1);
  });

  it("never exports integration credentials, secrets or webhook tokens", async () => {
    // These are sealed at rest. Decrypting them into a downloadable file would
    // recreate precisely the exposure the encryption removed — and the user
    // already holds these secrets with the provider.
    const out = await exportFor(BUSINESS_ID);
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain("super-secret");
    expect(serialised).not.toContain("tok_123");
    expect(serialised).not.toContain("sealed-blob");
    expect(out.integrations[0].credentials).toBe("[redacted — held encrypted, not exported]");
    // the non-secret fields survive, so the export is still useful
    expect(out.integrations[0]).toMatchObject({ provider: "icount" });
  });

  it("records who and when, so the file is self-describing", async () => {
    const out = await exportFor(BUSINESS_ID);
    expect(out.account).toEqual({ userId: USER_ID, email: "owner@example.com" });
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("produces an empty but well-formed export for an account with no business", async () => {
    const out = await exportFor(null);
    expect(out.business).toBeNull();
    expect(out.tasks).toEqual([]);
    expect(out.syncedContacts).toEqual([]);
    // still self-describing rather than a bare {}
    expect(out.account.userId).toBe(USER_ID);
  });

  it("scopes every read to the business id", async () => {
    const db = fakeDb(seed());
    await buildDataExport(db.client, {
      userId: USER_ID,
      email: null,
      businessId: BUSINESS_ID,
    });
    const scoped = db.calls.filter((c) => c.table !== "businesses");
    expect(scoped.length).toBeGreaterThan(0);
    for (const call of scoped) {
      expect(call.column).toBe("business_id");
      expect(call.value).toBe(BUSINESS_ID);
    }
  });
});

describe("retention", () => {
  it("keeps ingested customer data long enough to cover an annual filing", () => {
    // An annual return for year N is filed by 30 April of year N+1, so data
    // from January of year N must still be there — about 16 months. The window
    // has to exceed that.
    expect(SYNCED_DATA_RETENTION_DAYS).toBeGreaterThan(16 * 30);
  });

  it("but not indefinitely — the whole point is that it expires", () => {
    expect(SYNCED_DATA_RETENTION_DAYS).toBeLessThan(365 * 2);
  });

  it("computes the cutoff as a calendar date", () => {
    expect(retentionCutoff("2026-09-11", 1)).toBe("2026-09-10");
    expect(retentionCutoff("2026-01-01", 1)).toBe("2025-12-31");
    expect(retentionCutoff("2026-09-11", 365)).toBe("2025-09-11");
  });

  it("handles a leap day without drifting", () => {
    expect(retentionCutoff("2028-03-01", 1)).toBe("2028-02-29");
  });
});

describe("maskAccount", () => {
  it("shows only the last four digits", () => {
    expect(maskAccount("123456789")).toBe("•••• 6789");
  });

  it("returns short values unchanged rather than pretending to mask them", () => {
    // "••1" reveals as much as it hides, and looks like a security measure
    // while being none.
    expect(maskAccount("1234")).toBe("1234");
    expect(maskAccount("12")).toBe("12");
  });

  it("passes through empty values as null", () => {
    expect(maskAccount(null)).toBeNull();
    expect(maskAccount(undefined)).toBeNull();
    expect(maskAccount("")).toBeNull();
  });

  it("trims before masking, so trailing whitespace cannot shift the window", () => {
    expect(maskAccount("  123456789  ")).toBe("•••• 6789");
  });
});
