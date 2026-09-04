"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { setApplicationStatus } from "@/lib/actions";
import type { PartnerApplicationRow } from "@/lib/data";

const STATUS_TONE: Record<string, string> = {
  new: "bg-brand-tint text-brand-strong",
  approved: "bg-status-done-bg text-status-done",
  rejected: "bg-status-overdue-bg text-status-overdue",
};
const STATUS_LABEL: Record<string, string> = { new: "חדש", approved: "אושר", rejected: "נדחה" };

export function ApplicationRow({ app }: { app: PartnerApplicationRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="panel rounded-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{app.business_name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[app.status] ?? STATUS_TONE.new}`}>
              {STATUS_LABEL[app.status] ?? app.status}
            </span>
            {app.tier === "featured" && (
              <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand-strong">מודגש</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{app.service_type}</p>
          <p className="tnum mt-1 text-xs text-ink-muted" dir="ltr">
            {app.contact_name} · {app.email}{app.phone ? ` · ${app.phone}` : ""}
          </p>
          {app.website && (
            <a href={app.website} target="_blank" rel="noopener noreferrer" dir="ltr" className="mt-0.5 block text-xs text-brand-strong hover:underline">
              {app.website}
            </a>
          )}
          {app.message && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{app.message}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => start(() => setApplicationStatus(app.id, "approved"))}
            disabled={pending}
            aria-label="אישור"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-done-bg text-status-done transition hover:opacity-80 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          </button>
          <button
            onClick={() => start(() => setApplicationStatus(app.id, "rejected"))}
            disabled={pending}
            aria-label="דחייה"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-overdue-bg text-status-overdue transition hover:opacity-80 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
