import { ArrowLeft, Tag } from "lucide-react";
import type { OfferRow } from "@/lib/data";

/**
 * A partner offer. Always clearly labeled "הצעת שותף" — trust is the asset.
 * The free guidance always stands next to it; the offer is a shortcut, never a gate.
 */
export function OfferCard({ offer }: { offer: OfferRow }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-l from-brand-50/70 to-white p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-600">
        <Tag className="h-3.5 w-3.5" aria-hidden />
        הצעת שותף
      </div>
      <p className="font-semibold text-slate-900">{offer.title}</p>
      {offer.description && (
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
          {offer.description}
        </p>
      )}
      {offer.coupon_code && (
        <p className="mt-2 text-sm text-slate-700">
          קוד קופון:{" "}
          <span className="rounded-md bg-white px-2 py-0.5 font-mono font-bold text-brand-700 ring-1 ring-brand-200">
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
