import type { NormalizedBatch, NormalizedDocument, ProviderAdapter } from "./types";
import { EMPTY_BATCH } from "./types";

const BASE = "https://api.greeninvoice.co.il/api/v1";

/** Green Invoice document types we map into our normalized kinds. */
const KIND_BY_TYPE: Record<number, NormalizedDocument["kind"]> = {
  305: "invoice", // חשבונית מס
  320: "invoice", // חשבונית מס קבלה
  400: "receipt", // קבלה
  330: "credit", // חשבונית זיכוי
  10: "quote", // הצעת מחיר
};

async function getToken(creds: Record<string, string>): Promise<string> {
  const res = await fetch(`${BASE}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: creds.api_key, secret: creds.api_secret }),
  });
  if (!res.ok) throw new Error(`Green Invoice auth failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Green Invoice: no token in response");
  return data.token;
}

export const greenInvoiceAdapter: ProviderAdapter = {
  id: "greeninvoice",
  label: "Green Invoice / Morning",
  category: "invoicing",
  mode: "api",
  setupGuide:
    "בחשבון Green Invoice: הגדרות ← חיבור מערכות (API) ← יצירת מפתח. מעתיקים את ה-ID וה-Secret לכאן.",
  authFields: [
    { key: "api_key", label: "API Key ID", type: "text" },
    { key: "api_secret", label: "API Secret", type: "password" },
  ],
  pullableFields: [
    { key: "customer_name", label: "שמות לקוחות", default: true },
    { key: "allocation_number", label: "מספרי הקצאה (חשבוניות ישראל)", default: true },
    { key: "vat_amount", label: "סכומי מע\"מ", default: true },
  ],

  async testConnection(creds) {
    try {
      await getToken(creds);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "auth failed" };
    }
  },

  async pull(creds, since, fieldMap): Promise<NormalizedBatch> {
    const token = await getToken(creds);
    const fromDate = since ?? `${new Date().getFullYear()}-01-01`;

    const documents: NormalizedDocument[] = [];
    let page = 1;
    // paginate defensively; cap pages so a runaway account can't stall the cron
    while (page <= 20) {
      const res = await fetch(`${BASE}/documents/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromDate,
          page,
          pageSize: 100,
          sort: "documentDate",
        }),
      });
      if (!res.ok) throw new Error(`Green Invoice documents failed (${res.status})`);
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          type: number;
          amount?: number;
          vat?: number;
          documentDate?: string;
          client?: { name?: string };
          number?: string;
          status?: number;
          allocationNumber?: string;
        }>;
        totalPages?: number;
      };

      for (const item of data.items ?? []) {
        documents.push({
          external_id: item.id,
          kind: KIND_BY_TYPE[item.type] ?? "invoice",
          amount: item.amount ?? 0,
          vat_amount: fieldMap.vat_amount === false ? null : (item.vat ?? null),
          issued_at: item.documentDate ?? null,
          customer_name:
            fieldMap.customer_name === false ? null : (item.client?.name ?? null),
          allocation_number:
            fieldMap.allocation_number === false
              ? null
              : (item.allocationNumber ?? null),
          status: item.status != null ? String(item.status) : null,
        });
      }

      if (!data.totalPages || page >= data.totalPages) break;
      page++;
    }

    return { ...EMPTY_BATCH, documents };
  },
};
