import { CheckCircle2, FileCheck2, Receipt } from "lucide-react";

/**
 * Which periods were actually filed, and what was paid.
 *
 * Migration 030 has recorded every filing since it shipped and nothing
 * displayed it. So the product held the answer to the question a recurring duty
 * raises every period — "did I file Jul–Aug, and how much was it?" — and never
 * showed it. Without this the only evidence a user has that they filed is their
 * own memory, which is precisely what a compliance tool exists to replace.
 *
 * Append-only by policy (030 grants no DELETE), so this is a record, not a
 * list of editable rows. A correction is a re-filing of the same period, which
 * updates the row in place and keeps its identity.
 */

export interface FilingEntry {
  periodKey: string;
  /** "יולי–אוגוסט 2026" / "שנת 2026", when the period shape supports a name. */
  periodLabel: string | null;
  dueIso: string | null;
  filedAt: string;
  /** ₪, as the user entered it. */
  amount: string | null;
  reference: string | null;
}

function heDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

/**
 * ₪ after the number, which is where it goes in Hebrew, and agorot only when
 * they are not zero — "₪4,210.00" reads like a database field.
 */
export function formatIls(raw: string): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const hasAgorot = Math.round(n * 100) % 100 !== 0;
  return (
    n.toLocaleString("he-IL", {
      minimumFractionDigits: hasAgorot ? 2 : 0,
      maximumFractionDigits: 2,
    }) + " ₪"
  );
}

export function FilingHistory({ entries }: { entries: FilingEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-edge bg-surface/60 p-4">
      <h2 className="mb-1 flex items-start gap-2 text-section text-ink">
        <FileCheck2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" aria-hidden />
        התקופות שהוגשו
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">
        {entries.length === 1
          ? "תקופה אחת רשומה כמוגשת."
          : `${entries.length} תקופות רשומות כמוגשות.`}{" "}
        הרישום נשמר ואינו נמחק — תיקון הוא הגשה מחדש של אותה תקופה.
      </p>
      <ul className="flex flex-col divide-y divide-edge-soft">
        {entries.map((e) => {
          const money = e.amount ? formatIls(e.amount) : null;
          return (
            <li key={e.periodKey} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-medium leading-snug text-ink">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-done" aria-hidden />
                  {e.periodLabel ?? (
                    // The raw key is two Latin runs around "..", and the bidi
                    // algorithm reorders them inside an RTL line: 2026-01..2026-12
                    // rendered as "2026-12..2026-01", which reads as a period
                    // running from December to January. A reversed identifier is
                    // worse than an ugly one.
                    <span dir="ltr">{e.periodKey}</span>
                  )}
                </span>
                <span className="tnum shrink-0 text-xs text-ink-muted">
                  הוגש {heDate(e.filedAt)}
                </span>
              </div>
              {(money || e.reference) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 ps-5 text-xs text-ink-muted">
                  {money && (
                    <span className="inline-flex items-center gap-1">
                      <Receipt className="h-3 w-3 shrink-0" aria-hidden />
                      {money}
                    </span>
                  )}
                  {e.reference && (
                    <span>
                      אסמכתא{" "}
                      {/* A confirmation number is a Latin-digit string and
                          reorders inside an RTL paragraph without this. */}
                      <span dir="ltr" className="tnum text-ink-soft">
                        {e.reference}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
