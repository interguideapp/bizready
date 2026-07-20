"use client";

import { useTransition } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { resolveSyncError } from "@/lib/integration-actions";
import { Card } from "@/components/ui";
import type { SyncErrorRow } from "@/lib/data";

const CODE_LABELS: Record<string, string> = {
  missing_allocation: "חסר מספר הקצאה",
  sync_failed: "סנכרון נכשל",
  unknown_event: "אירוע לא מוכר",
  invalid_document: "מסמך לא תקין",
  invalid_payment: "תשלום לא תקין",
  invalid_lead: "ליד לא תקין",
  invalid_order: "הזמנה לא תקינה",
  invalid_row: "שורה לא תקינה",
};

export function ErrorsList({ errors }: { errors: SyncErrorRow[] }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-edge-soft px-5 py-3 font-bold text-status-overdue">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        שגיאות פתוחות ({errors.length})
      </h2>
      <div className="divide-y divide-edge-soft">
        {errors.map((e) => (
          <ErrorRow key={e.id} error={e} />
        ))}
      </div>
    </Card>
  );
}

function ErrorRow({ error }: { error: SyncErrorRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {CODE_LABELS[error.code] ?? error.code}
        </p>
        <p className="text-xs text-ink-muted">{error.message}</p>
        <p className="mt-0.5 text-[11px] text-ink-faint">
          {new Date(error.occurred_at).toLocaleString("he-IL")}
        </p>
      </div>
      <button
        onClick={() => startTransition(() => resolveSyncError(error.id))}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-status-done hover:text-status-done disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden />
        )}
        טופל
      </button>
    </div>
  );
}
