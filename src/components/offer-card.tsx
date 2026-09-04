import Link from "next/link";
import { ArrowLeft, Link2, Sparkles, Tag } from "lucide-react";
import type { OfferRow } from "@/lib/data";

/**
 * A partner offer. Always clearly labeled "הצעת שותף" — trust is the asset.
 * The free guidance always stands next to it; the offer is a shortcut, never a gate.
 * `helpsTask` shows which task the offer advances, so the value is explicit.
 */
export function OfferCard({
  offer,
  helpsTask,
}: {
  offer: OfferRow;
  helpsTask?: { id: string; title: string } | null;
}) {
  const featured = offer.is_featured;
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-l from-brand-tint/70 to-card p-4 ${
        featured ? "border-brand-edge shadow-e-brand ring-1 ring-brand-edge/50" : "border-brand-edge"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
          <Tag className="h-3.5 w-3.5" aria-hidden />
          הצעת שותף
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
          {featured && <Sparkles className="h-3 w-3" aria-hidden />}
          מקודם
        </span>
      </div>
      <p className="font-semibold text-ink">{offer.title}</p>
      {helpsTask && (
        <Link
          href={`/tasks/${helpsTask.id}`}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
        >
          <Link2 className="h-3 w-3" aria-hidden />
          עוזר במשימה: {helpsTask.title}
        </Link>
      )}
      {offer.description && (
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
          {offer.description}
        </p>
      )}
      {offer.coupon_code && (
        <p className="mt-2 text-sm text-ink-soft">
          קוד קופון:{" "}
          <span className="rounded-md bg-card px-2 py-0.5 font-mono font-bold text-brand-strong ring-1 ring-brand-edge">
            {offer.coupon_code}
          </span>
        </p>
      )}
      {offer.url && (
        <a
          href={`/api/offers/${offer.id}/click`}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {offer.cta_label || "לפרטים"}
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </a>
      )}
    </div>
  );
}
