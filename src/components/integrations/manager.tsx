"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Card } from "@/components/ui";
import { toast } from "@/components/toaster";
import {
  createConnection,
  disconnectConnection,
  syncConnectionNow,
} from "@/lib/actions";

export interface ProviderInfo {
  id: string;
  label: string;
  mode: "api" | "webhook" | "csv";
  setupGuide: string;
  authFields: { key: string; label: string; type?: string; placeholder?: string }[];
  pullableFields: { key: string; label: string; default: boolean }[];
}
export interface ConnectionInfo {
  id: string;
  provider: string;
  mode: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  webhook_token: string;
}

const field =
  "w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge";

export function IntegrationsManager({
  providers,
  connections,
}: {
  providers: ProviderInfo[];
  connections: ConnectionInfo[];
}) {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const active = connections.filter((c) => c.status !== "disabled");
  const usedProviders = new Set(active.map((c) => c.provider));

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-section text-ink">מחוברים</h2>
          <div className="flex flex-col gap-2.5">
            {active.map((c) => (
              <ConnectionRow key={c.id} conn={c} label={byId.get(c.provider)?.label ?? c.provider} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-section text-ink">הוספת חיבור — חשבוניות</h2>
        <div className="flex flex-col gap-2.5">
          {providers.map((p) => (
            <ProviderTile key={p.id} provider={p} alreadyConnected={usedProviders.has(p.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ConnectionRow({ conn, label }: { conn: ConnectionInfo; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const webhookUrl =
    conn.mode === "webhook" && typeof window !== "undefined"
      ? `${window.location.origin}/api/hooks/${conn.webhook_token}`
      : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-ink">{label}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                conn.status === "error"
                  ? "bg-status-overdue-bg text-status-overdue"
                  : "bg-status-done-bg text-status-done"
              }`}
            >
              {conn.status === "error" ? "שגיאה" : "מחובר"}
            </span>
          </div>
          <p className="tnum mt-0.5 text-xs text-ink-muted">
            {conn.last_sync_at
              ? `סונכרן: ${new Date(conn.last_sync_at).toLocaleDateString("he-IL")}`
              : "טרם סונכרן"}
          </p>
          {conn.last_error && <p className="mt-1 text-xs text-status-overdue">{conn.last_error}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {conn.mode === "api" && (
            <button
              onClick={() =>
                start(async () => {
                  const res = await syncConnectionNow(conn.id);
                  if (res.ok) {
                    toast.success(res.inserted ? `סונכרנו ${res.inserted} רשומות` : "מעודכן");
                    router.refresh();
                  } else toast.error(res.error ?? "הסנכרון נכשל");
                })
              }
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand-strong transition hover:opacity-80 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              סנכרן עכשיו
            </button>
          )}
          <button
            onClick={() =>
              start(async () => {
                await disconnectConnection(conn.id);
                toast("החיבור נותק");
                router.refresh();
              })
            }
            disabled={pending}
            aria-label="ניתוק"
            className="inline-flex items-center justify-center rounded-lg bg-surface-2 px-2.5 py-1.5 text-ink-muted transition hover:text-ink disabled:opacity-50"
          >
            <Unplug className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {webhookUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
          <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{webhookUrl}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(webhookUrl); toast.success("הועתק"); }}
            aria-label="העתקה"
            className="shrink-0 text-ink-muted hover:text-ink"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </Card>
  );
}

function ProviderTile({ provider, alreadyConnected }: { provider: ProviderInfo; alreadyConnected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [fieldMap, setFieldMap] = useState<Record<string, boolean>>(
    Object.fromEntries(provider.pullableFields.map((f) => [f.key, f.default]))
  );
  const [pending, start] = useTransition();
  const isCsv = provider.mode === "csv";

  function submitApi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const creds: Record<string, string> = {};
    for (const a of provider.authFields) creds[a.key] = String(f.get(a.key) ?? "");
    start(async () => {
      const res = await createConnection(provider.id, creds, fieldMap);
      if (res.ok) { toast.success(`${provider.label} חובר`); setOpen(false); router.refresh(); }
      else setError(res.error ?? "החיבור נכשל");
    });
  }

  function addWebhook() {
    start(async () => {
      const res = await createConnection(provider.id, {}, {});
      if (res.ok) { toast.success("נוצר — העתיקו את כתובת ה-Webhook"); setOpen(false); router.refresh(); }
      else toast.error(res.error ?? "נכשל");
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
            <Plug className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-ink">{provider.label}</p>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              {provider.mode === "api" ? "API ישיר" : provider.mode === "webhook" ? "Webhook" : "קובץ CSV"}
            </p>
          </div>
        </div>
        {alreadyConnected ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-done">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> מחובר
          </span>
        ) : isCsv ? (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">בקרוב</span>
        ) : (
          <button
            onClick={() => (provider.mode === "webhook" ? addWebhook() : setOpen((v) => !v))}
            disabled={pending}
            className="rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-e-brand transition hover:opacity-95 disabled:opacity-60"
          >
            {pending && provider.mode === "webhook" ? "…" : "חיבור"}
          </button>
        )}
      </div>

      {open && provider.mode === "api" && (
        <form onSubmit={submitApi} className="mt-4 border-t border-edge-soft pt-4">
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">{provider.setupGuide}</p>
          <div className="flex flex-col gap-2.5">
            {provider.authFields.map((a) => (
              <label key={a.key} className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">{a.label}</span>
                <input name={a.key} type={a.type === "password" ? "password" : "text"} dir="ltr" placeholder={a.placeholder} className={field} required />
              </label>
            ))}
          </div>
          {provider.pullableFields.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-ink-muted">מה למשוך (פרטיות):</p>
              <div className="flex flex-wrap gap-3">
                {provider.pullableFields.map((pf) => (
                  <label key={pf.key} className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={fieldMap[pf.key] ?? pf.default}
                      onChange={(e) => setFieldMap((m) => ({ ...m, [pf.key]: e.target.checked }))}
                      className="h-4 w-4 rounded"
                    />
                    {pf.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-status-overdue">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-status-done px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              בדיקה וחיבור
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-ink">ביטול</button>
          </div>
        </form>
      )}
    </Card>
  );
}
