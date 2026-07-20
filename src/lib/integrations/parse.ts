import type {
  NormalizedBatch,
  NormalizedContact,
  NormalizedDocument,
  NormalizedOrder,
} from "./types";
import { EMPTY_BATCH } from "./types";

/**
 * Parses an incoming webhook payload into a normalized batch.
 *
 * The payload is UNTRUSTED user-configured input: everything is type-checked,
 * clamped, and truncated. Unknown events are reported, never thrown.
 */

const MAX_STRING = 200;
const MAX_AMOUNT = 100_000_000;
const MAX_EVENTS = 200;

export interface ParseResult {
  batch: NormalizedBatch;
  errors: { code: string; message: string }[];
}

type Payload = { event?: unknown; data?: unknown };

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, MAX_STRING) : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(-MAX_AMOUNT, Math.min(MAX_AMOUNT, Math.round(n * 100) / 100));
}

function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const DOC_KINDS = new Set(["invoice", "receipt", "credit", "quote"]);
const STAGES = new Set(["lead", "prospect", "customer", "lost"]);

export function parseWebhookPayload(raw: unknown): ParseResult {
  const errors: ParseResult["errors"] = [];
  const batch: NormalizedBatch = {
    documents: [],
    contacts: [],
    orders: [],
  };

  // accept a single event object or {events: [...]}
  const events: Payload[] = Array.isArray((raw as { events?: unknown })?.events)
    ? ((raw as { events: Payload[] }).events).slice(0, MAX_EVENTS)
    : [raw as Payload];

  for (const item of events) {
    const event = str(item?.event);
    const data = (item?.data ?? {}) as Record<string, unknown>;

    switch (event) {
      case "document.created":
      case "document.updated": {
        const externalId = str(data.external_id) ?? str(data.id);
        const amount = num(data.amount);
        if (!externalId || amount === null) {
          errors.push({
            code: "invalid_document",
            message: "document event missing external_id or amount",
          });
          break;
        }
        const kindRaw = str(data.kind) ?? "invoice";
        const doc: NormalizedDocument = {
          external_id: externalId,
          kind: (DOC_KINDS.has(kindRaw) ? kindRaw : "invoice") as NormalizedDocument["kind"],
          amount,
          vat_amount: num(data.vat_amount),
          currency: str(data.currency) ?? "ILS",
          issued_at: isoDate(data.issued_at) ?? isoDate(data.date),
          customer_name: str(data.customer_name) ?? str(data.customer),
          allocation_number: str(data.allocation_number),
          status: str(data.status),
        };
        batch.documents.push(doc);
        break;
      }

      case "payment.received":
      case "payment.failed": {
        const externalId = str(data.external_id) ?? str(data.id);
        const amount = num(data.amount);
        if (!externalId || amount === null) {
          errors.push({ code: "invalid_payment", message: "payment event missing id or amount" });
          break;
        }
        // payments ride the documents rail as receipts so they aggregate cleanly
        batch.documents.push({
          external_id: `pay-${externalId}`,
          kind: "receipt",
          amount,
          currency: str(data.currency) ?? "ILS",
          issued_at: isoDate(data.date) ?? new Date().toISOString().slice(0, 10),
          customer_name: str(data.customer_name),
          status: event === "payment.failed" ? "failed" : "paid",
        });
        break;
      }

      case "lead.created":
      case "lead.updated": {
        const externalId = str(data.external_id) ?? str(data.id);
        if (!externalId) {
          errors.push({ code: "invalid_lead", message: "lead event missing external_id" });
          break;
        }
        const stageRaw = str(data.stage) ?? "lead";
        const contact: NormalizedContact = {
          external_id: externalId,
          name: str(data.name),
          stage: (STAGES.has(stageRaw) ? stageRaw : "lead") as NormalizedContact["stage"],
          source: str(data.source),
          value: num(data.value),
          occurred_at: isoDate(data.date) ?? new Date().toISOString().slice(0, 10),
        };
        batch.contacts.push(contact);
        break;
      }

      case "order.created":
      case "order.updated": {
        const externalId = str(data.external_id) ?? str(data.id);
        const total = num(data.total) ?? num(data.amount);
        if (!externalId || total === null) {
          errors.push({ code: "invalid_order", message: "order event missing id or total" });
          break;
        }
        const order: NormalizedOrder = {
          external_id: externalId,
          total,
          status: str(data.status),
          items_count: num(data.items_count),
          placed_at: isoDate(data.date) ?? new Date().toISOString().slice(0, 10),
        };
        batch.orders.push(order);
        break;
      }

      default:
        errors.push({
          code: "unknown_event",
          message: `unknown event: ${event ?? "(missing)"}`,
        });
    }
  }

  return { batch, errors };
}

/** Parses CSV rows (already split) into a batch, by target type. */
export function parseCsvRows(
  target: "documents" | "contacts" | "orders",
  rows: Record<string, string>[]
): ParseResult {
  const errors: ParseResult["errors"] = [];
  const batch: NormalizedBatch = { ...EMPTY_BATCH, documents: [], contacts: [], orders: [] };

  rows.slice(0, 5000).forEach((row, i) => {
    if (target === "documents") {
      const amount = num(row.amount ?? row["סכום"]);
      if (amount === null) {
        errors.push({ code: "invalid_row", message: `row ${i + 1}: bad amount` });
        return;
      }
      batch.documents.push({
        external_id: str(row.external_id) ?? `csv-${i}-${row.date ?? row["תאריך"] ?? ""}-${amount}`,
        kind: "invoice",
        amount,
        vat_amount: num(row.vat ?? row["מעמ"] ?? row["מע\"מ"]),
        issued_at: isoDate(row.date ?? row["תאריך"]),
        customer_name: str(row.customer ?? row["לקוח"]),
        allocation_number: str(row.allocation_number ?? row["מספר הקצאה"]),
      });
    } else if (target === "contacts") {
      const name = str(row.name ?? row["שם"]);
      batch.contacts.push({
        external_id: str(row.external_id) ?? `csv-${i}-${name ?? "lead"}`,
        name,
        stage: "lead",
        source: str(row.source ?? row["מקור"]),
        value: num(row.value ?? row["שווי"]),
        occurred_at: isoDate(row.date ?? row["תאריך"]),
      });
    } else {
      const total = num(row.total ?? row.amount ?? row["סכום"]);
      if (total === null) {
        errors.push({ code: "invalid_row", message: `row ${i + 1}: bad total` });
        return;
      }
      batch.orders.push({
        external_id: str(row.external_id) ?? `csv-${i}-${row.date ?? ""}-${total}`,
        total,
        status: str(row.status ?? row["סטטוס"]),
        placed_at: isoDate(row.date ?? row["תאריך"]),
      });
    }
  });

  return { batch, errors };
}

/** Tiny CSV splitter (comma/semicolon, quoted values, header row). */
export function splitCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes) {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = false;
        } else if (cur === "") {
          // a quote only opens quoting at the start of a field —
          // mid-field quotes (בע"מ, inches) are literal characters
          inQuotes = true;
        } else {
          cur += '"';
        }
      } else if (ch === delim && !inQuotes) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}
