"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Link2,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createConnection,
  disconnectConnection,
  importCsv,
  syncNow,
} from "@/lib/integration-actions";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PROVIDERS,
  PROVIDERS_BY_ID,
} from "@/lib/integrations/registry";
import type { ConnectionListRow } from "@/lib/data";
import { Card } from "@/components/ui";

export function IntegrationsManager({
  connections,
  appUrl,
}: {
  connections: ConnectionListRow[];
  appUrl: string;
}) {
  const [adding, setAdding] = useState<string | null>(null); // provider id

  const byCategory = useMemo(() => {
    const map = new Map<string, ConnectionListRow[]>();
    for (const c of connections) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [connections]);

  return (
    <div className="flex flex-col gap-6">
      {CATEGORY_ORDER.map((category) => {
        const providers = PROVIDERS.filter((p) => p.category === category);
        if (providers.length === 0) return null;
        const connected = byCategory.get(category) ?? [];
        return (
          <section key={category}>
            <div className="mb-2.5 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected.some((c) => c.status === "error")
                    ? "bg-status-overdue"
                    : connected.length > 0
                      ? "bg-status-done"
                      : "bg-surface-3"
                }`}
              />
              <h2 className="font-bold text-ink">{CATEGORY_LABELS[category]}</h2>
              <span className="mr-auto text-xs text-ink-muted">
                {connected.length > 0 ? `${connected.length} מחובר` : "לא מחובר"}
              </span>
            </div>

            <Card className="divide-y divide-edge-soft">
              {connected.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  appUrl={appUrl}
                />
              ))}

              {/* providers available to add */}
              {providers.map((provider) => (
                <div key={provider.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Plug className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{provider.label}</p>
                      <p className="text-xs text-ink-muted">
                        {provider.mode === "api"
                          ? "חיבור ישיר עם מפתח API"
                          : provider.mode === "webhook"
                            ? "קבלת אירועים אוטומטית (Webhook)"
                            : "ייבוא קובץ CSV"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setAdding(adding === provider.id ? null : provider.id)
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      חיבור
                    </button>
                  </div>
                  {adding === provider.id && (
                    <ConnectForm
                      providerId={provider.id}
                      onDone={() => setAdding(null)}
                    />
                  )}
                </div>
              ))}
            </Card>
          </section>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-faint">
        לכל מערכת שאין לה חיבור ישיר: Make או Zapier מתחברים כמעט לכל כלי
        ישראלי ושולחים אלינו את האירועים — המדריך המלא ב-docs/INTEGRATIONS.md
        בפרויקט.
      </p>
    </div>
  );
}

/* ---------- connect form ---------- */

function ConnectForm({
  providerId,
  onDone,
}: {
  providerId: string;
  onDone: () => void;
}) {
  const provider = PROVIDERS_BY_ID.get(providerId)!;
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [fieldMap, setFieldMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(provider.pullableFields.map((f) => [f.key, f.default]))
  );
  const [useSecret, setUseSecret] = useState(true);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await createConnection({
        provider: providerId,
        credentials: creds,
        fieldMap,
        useSecret: provider.mode === "webhook" && useSecret,
      });
      if (!result.ok) setError(result.error ?? "החיבור נכשל");
      else onDone();
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-edge bg-brand-tint/30 p-4">
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">{provider.setupGuide}</p>

      {provider.authFields.map((field) => (
        <label key={field.key} className="mb-2.5 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">
            {field.label}
          </span>
          <input
            type={field.type === "password" ? "password" : "text"}
            dir="ltr"
            value={creds[field.key] ?? ""}
            onChange={(e) =>
              setCreds((c) => ({ ...c, [field.key]: e.target.value }))
            }
            className="w-full rounded-xl border border-edge bg-card px-3 py-2.5 text-left text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
        </label>
      ))}

      {provider.pullableFields.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold text-ink-soft">מה למשוך?</p>
          {provider.pullableFields.map((field) => (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-soft"
            >
              <input
                type="checkbox"
                checked={fieldMap[field.key] ?? field.default}
                onChange={(e) =>
                  setFieldMap((m) => ({ ...m, [field.key]: e.target.checked }))
                }
                className="h-4 w-4 accent-brand-600"
              />
              {field.label}
            </label>
          ))}
        </div>
      )}

      {provider.mode === "webhook" && (
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={useSecret}
            onChange={(e) => setUseSecret(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          אבטחת חתימה (HMAC) — מומלץ כשהמערכת השולחת תומכת
        </label>
      )}

      {error && <p className="mb-2 text-xs text-status-overdue">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {provider.mode === "api" ? "בדיקה וחיבור" : "יצירת חיבור"}
        </button>
        <button
          onClick={onDone}
          className="rounded-xl px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

/* ---------- existing connection row ---------- */

function ConnectionRow({
  connection,
  appUrl,
}: {
  connection: ConnectionListRow;
  appUrl: string;
}) {
  const provider = PROVIDERS_BY_ID.get(connection.provider);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const webhookUrl = `${appUrl || (typeof location !== "undefined" ? location.origin : "")}/api/hooks/${connection.webhook_token}`;

  function runSync() {
    setMessage("");
    startTransition(async () => {
      const result = await syncNow(connection.id);
      setMessage(
        result.ok ? `✓ נמשכו ${result.inserted} רשומות חדשות` : `✗ ${result.error}`
      );
    });
  }

  function onCsv(file: File) {
    setMessage("");
    startTransition(async () => {
      const text = await file.text();
      const target =
        connection.category === "crm"
          ? "contacts"
          : connection.category === "ecommerce"
            ? "orders"
            : "documents";
      const result = await importCsv(connection.id, target, text);
      setMessage(
        result.ok
          ? `✓ נקלטו ${result.inserted} שורות${result.rejected ? `, נדחו ${result.rejected}` : ""}`
          : `✗ ${result.error}`
      );
    });
  }

  return (
    <div className="bg-brand-tint/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            connection.status === "error" ? "bg-status-overdue" : "bg-status-done"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {provider?.label ?? connection.provider}
          </p>
          <p className="text-xs text-ink-muted">
            {connection.status === "error"
              ? `שגיאה: ${connection.last_error ?? ""}`
              : connection.last_sync_at
                ? `סנכרון אחרון: ${new Date(connection.last_sync_at).toLocaleString("he-IL")}`
                : "מחובר — ממתין לנתונים ראשונים"}
          </p>
        </div>

        {connection.mode === "api" && (
          <button
            onClick={runSync}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            סנכרן
          </button>
        )}
        {connection.mode === "csv" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsv(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              ייבוא
            </button>
          </>
        )}
        {connection.mode === "webhook" && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            כתובת
            <ChevronDown
              className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}
        <button
          onClick={() =>
            confirm("לנתק את החיבור? הנתונים שכבר נמשכו יישמרו.") &&
            startTransition(() => disconnectConnection(connection.id))
          }
          aria-label="ניתוק"
          className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-status-overdue"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {message && <p className="mt-1.5 pr-6 text-xs text-ink-soft">{message}</p>}

      {open && connection.mode === "webhook" && (
        <div className="mt-3 flex flex-col gap-2 pr-6">
          <CopyLine label="כתובת Webhook" value={webhookUrl} />
          {connection.webhook_secret && (
            <CopyLine label="Secret (לחתימת HMAC)" value={connection.webhook_secret} />
          )}
          <p className="text-xs text-ink-faint">
            שלחו POST עם JSON:{" "}
            <code dir="ltr" className="rounded bg-surface-2 px-1.5 py-0.5">
              {'{"event":"document.created","data":{"id":"...","amount":1200}}'}
            </code>
          </p>
        </div>
      )}
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 text-xs text-ink-muted">{label}</span>
      <code
        dir="ltr"
        className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2 py-1 text-left text-xs text-ink-soft"
      >
        {value}
      </code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label={`העתקת ${label}`}
        className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-brand-strong"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-status-done" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
