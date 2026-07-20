/**
 * The integration hub's shared vocabulary.
 *
 * Every external system — direct API, standardized webhook, or CSV — is
 * normalized into ONE small model (`NormalizedBatch`). Nothing downstream ever
 * knows which provider a datum came from; the apply engine only sees the batch.
 */

export type IntegrationCategory =
  | "invoicing"
  | "crm"
  | "ecommerce"
  | "payments"
  | "payroll"
  | "accounting"
  | "other";

export type ConnectionMode = "api" | "webhook" | "csv";

export interface NormalizedDocument {
  external_id: string;
  kind: "invoice" | "receipt" | "credit" | "quote";
  amount: number;
  vat_amount?: number | null;
  currency?: string;
  issued_at?: string | null; // ISO date
  customer_name?: string | null;
  allocation_number?: string | null;
  status?: string | null;
  extra?: Record<string, unknown>;
}

export interface NormalizedContact {
  external_id: string;
  name?: string | null;
  stage?: "lead" | "prospect" | "customer" | "lost";
  source?: string | null;
  value?: number | null;
  occurred_at?: string | null;
}

export interface NormalizedOrder {
  external_id: string;
  total: number;
  status?: string | null;
  items_count?: number | null;
  placed_at?: string | null;
}

export interface NormalizedBatch {
  documents: NormalizedDocument[];
  contacts: NormalizedContact[];
  orders: NormalizedOrder[];
}

export const EMPTY_BATCH: NormalizedBatch = {
  documents: [],
  contacts: [],
  orders: [],
};

export interface AuthField {
  key: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
}

/** Optional fields the user can choose to pull (the field picker). */
export interface PullableField {
  key: string;
  label: string;
  default: boolean;
}

export interface ProviderAdapter {
  id: string;
  label: string;
  category: IntegrationCategory;
  mode: ConnectionMode;
  /** Short setup instructions shown in the connect dialog (Hebrew). */
  setupGuide: string;
  /** Credentials the connect dialog collects (api mode only). */
  authFields: AuthField[];
  /** Fields the user may opt in/out of pulling. */
  pullableFields: PullableField[];
  /** api mode: verify the credentials work. */
  testConnection?: (creds: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  /** api mode: pull everything since `since` (ISO date) into the normalized model. */
  pull?: (
    creds: Record<string, string>,
    since: string | null,
    fieldMap: Record<string, boolean>
  ) => Promise<NormalizedBatch>;
}

export interface ConnectionRow {
  id: string;
  business_id: string;
  provider: string;
  category: IntegrationCategory;
  mode: ConnectionMode;
  credentials: Record<string, string>;
  field_map: Record<string, boolean>;
  webhook_token: string;
  webhook_secret: string | null;
  status: "connected" | "error" | "disabled";
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}
