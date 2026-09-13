import Link from "next/link";
import { Megaphone } from "lucide-react";

/**
 * Slot for professionals to advertise, at the bottom of the Shop.
 *
 * The docstring used to add "shown in task pages with no partner yet", and the
 * only caller is /shop. It also built an encoded mailto subject from a
 * `context` prop — the remains of the funnel that mailed a hardcoded personal
 * Gmail. Both the subject and the prop that fed it were dead once the CTA
 * became a link to /partners, and nothing passed context anyway.
 */
export function AdvertiseCard() {
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
      <Link
        href="/partners"
        className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-edge px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand-edge hover:text-brand-strong"
      >
        פרסמו כאן
      </Link>
    </div>
  );
}
