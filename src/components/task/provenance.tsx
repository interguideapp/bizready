import { AlertTriangle, ExternalLink, Scale, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { BASIS_EXPLAINER, BASIS_LABEL, type LegalBasis } from "@/lib/content/legal-basis";
import { formatReviewDate, stalenessNotice, type ReviewAge } from "@/lib/staleness";

/**
 * Where this task's content comes from, and how old it is.
 *
 * Every template already carried `last_reviewed` and `source_url`, and nothing
 * read either one. So the page that states "מס חברות 23%" and "עד ₪1,000 פיצוי"
 * gave the user no way to tell whether those numbers were checked last month or
 * typed in once and forgotten — and carried no disclaimer at all, because the
 * shared `Disclaimer` rendered on only two other pages.
 *
 * This is the fix, and it is deliberately unglamorous: say what kind of
 * obligation this is, say when it was last verified, link the source, and warn
 * when the review has aged out.
 */
export function ProvenanceCard({
  legalBasis,
  reviewAge,
  sourceUrl,
}: {
  legalBasis: LegalBasis;
  reviewAge: ReviewAge;
  sourceUrl: string | null;
}) {
  const notice = stalenessNotice(reviewAge);
  const isLaw = legalBasis === "statute";

  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-soft">
        <Scale className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        על מה זה מבוסס
      </p>

      <BasisChip basis={legalBasis} />
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{BASIS_EXPLAINER[legalBasis]}</p>

      <div className="mt-3 border-t border-edge-soft pt-3">
        {reviewAge.reviewedOn ? (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {"נבדק מול המקור ב-"}
              <time dateTime={reviewAge.reviewedOn} dir="ltr">
                {formatReviewDate(reviewAge.reviewedOn)}
              </time>
            </span>
          </p>
        ) : null}

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
          >
            המקור שהמידע נכתב לפיו
            <ExternalLink
              className="h-3 w-3 shrink-0 text-ink-muted group-hover:text-brand-500"
              aria-hidden
            />
          </a>
        )}
      </div>

      {notice && (
        <p
          // Aging content is a caution. Stale content on a statutory duty is the
          // most misleading thing this product can show, so it gets the loud
          // treatment.
          className={`mt-3 flex gap-2 rounded-xl border p-2.5 text-xs leading-relaxed ${
            reviewAge.state === "stale" && isLaw
              ? "border-status-overdue/30 bg-status-overdue-bg text-ink-soft"
              : "border-edge-soft bg-surface-2 text-ink-muted"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {isLaw
          ? 'זה מידע כללי על חובה קיימת, לא ייעוץ משפטי או מיסויי. במקרים לא שגרתיים התייעצו עם רו"ח או עורך דין.'
          : "זה מידע כללי, לא ייעוץ משפטי, מיסויי או פיננסי."}
      </p>
    </Card>
  );
}

/** The basis label, shown in the hero next to the priority badge. */
export function BasisChip({ basis }: { basis: LegalBasis }) {
  // Only "the law requires this" gets emphasis. If every chip were coloured,
  // the distinction the chip exists to draw would disappear again.
  const tone =
    basis === "statute"
      ? "border-status-overdue/30 bg-status-overdue-bg text-ink"
      : "border-edge-soft bg-surface-2 text-ink-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {BASIS_LABEL[basis]}
    </span>
  );
}
