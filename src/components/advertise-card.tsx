import { Megaphone } from "lucide-react";

/**
 * Slot for professionals to advertise: shown in task pages with no partner yet
 * and at the bottom of the Shop. Leads go to the business inbox.
 */
export function AdvertiseCard({ context }: { context?: string }) {
  const subject = encodeURIComponent(
    `פרסום ב-BizReady${context ? ` — ${context}` : ""}`
  );
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-edge bg-surface/60 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted">
        <Megaphone className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-soft">
          בעל/ת מקצוע בתחום? הלקוחות שלנו מחפשים אתכם
        </p>
        <p className="text-xs text-ink-muted">
          הופיעו כאן כשותף מומלץ — מול עסקים בדיוק ברגע שהם צריכים אתכם
        </p>
      </div>
      <a
        href={`mailto:interguide.app@gmail.com?subject=${subject}`}
        className="shrink-0 rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
      >
        פרסמו כאן
      </a>
    </div>
  );
}
