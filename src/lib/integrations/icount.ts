import type { NormalizedBatch, NormalizedDocument, ProviderAdapter } from "./types";
import { EMPTY_BATCH } from "./types";

const BASE = "https://api.icount.co.il/api/v3.php";

/** iCount doctype → normalized kind. */
const KIND_BY_DOCTYPE: Record<string, NormalizedDocument["kind"]> = {
  invoice: "invoice",
  invrec: "invoice",
  receipt: "receipt",
  refund: "credit",
  offer: "quote",
};

async function call(
  endpoint: string,
  creds: Record<string, string>,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid: creds.company_id,
      user: creds.username,
      pass: creds.password,
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`iCount ${endpoint} failed (${res.status})`);
  const data = (await res.json()) as Record<string, unknown> & {
    status?: boolean;
    reason?: string;
  };
  if (data.status === false) throw new Error(`iCount: ${data.reason ?? "request failed"}`);
  return data;
}

export const icountAdapter: ProviderAdapter = {
  id: "icount",
  label: "iCount",
  category: "invoicing",
  mode: "api",
  setupGuide:
    "מתחברים עם פרטי החשבון ב-iCount: מזהה חברה (CID), שם משתמש וסיסמה. מומלץ ליצור משתמש API ייעודי עם הרשאות צפייה בלבד.",
  authFields: [
    { key: "company_id", label: "מזהה חברה (CID)", type: "text" },
    { key: "username", label: "שם משתמש", type: "text" },
    { key: "password", label: "סיסמה", type: "password" },
  ],
  pullableFields: [
    { key: "customer_name", label: "שמות לקוחות", default: true },
    { key: "allocation_number", label: "מספרי הקצאה (חשבוניות ישראל)", default: true },
    { key: "vat_amount", label: "סכומי מע\"מ", default: true },
  ],

  async testConnection(creds) {
    try {
      await call("auth/login", creds, {});
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "auth failed" };
    }
  },

  async pull(creds, since, fieldMap): Promise<NormalizedBatch> {
    const fromDate = since ?? `${new Date().getFullYear()}-01-01`;
    const data = await call("doc/list", creds, {
      from_date: fromDate,
      detail_level: 1,
      limit: 1000,
    });

    interface ICountDoc {
      docnum?: string | number;
      doctype?: string;
      total?: number | string;
      total_vat?: number | string;
      doc_date?: string;
      client_name?: string;
      status?: string | number;
      allocation_number?: string;
    }
    const raw = data.docs_list ?? data.results ?? [];
    const docs: ICountDoc[] = Array.isArray(raw)
      ? (raw as ICountDoc[])
      : (Object.values(raw as Record<string, ICountDoc>) as ICountDoc[]);

    const documents: NormalizedDocument[] = [];
    for (const doc of docs) {
      if (!doc || doc.docnum == null) continue;
      documents.push({
        external_id: `${doc.doctype ?? "doc"}-${doc.docnum}`,
        kind: KIND_BY_DOCTYPE[doc.doctype ?? ""] ?? "invoice",
        amount: Number(doc.total ?? 0),
        vat_amount:
          fieldMap.vat_amount === false ? null : Number(doc.total_vat ?? 0),
        issued_at: doc.doc_date ?? null,
        customer_name:
          fieldMap.customer_name === false ? null : (doc.client_name ?? null),
        allocation_number:
          fieldMap.allocation_number === false
            ? null
            : (doc.allocation_number ?? null),
        status: doc.status != null ? String(doc.status) : null,
      });
    }

    return { ...EMPTY_BATCH, documents };
  },
};
