import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink } from "lucide-react";
import { BASIS_LABEL } from "@/lib/content/legal-basis";
import {
  URGENCY_LABEL,
  reviewQueueSummary,
  type ReviewItem,
} from "@/lib/content/review-queue";

/**
 * The content review queue: which of our legal claims are we no longer sure about?
 *
 * Nobody could answer that before. `last_reviewed` was write-only, and only two
 * distinct values existed across all 70 templates — the field recorded when the
 * file was last edited, not when the rule was last verified.
 *
 * Ordered by consequence: a stale statute claim is the product telling a
 * business owner "the law requires this" on a check nobody has repeated in over
 * a year. A stale marketing tip is a stale marketing tip.
 */
export function ReviewQueuePanel({
  items,
  januaryDue,
  movedSources = [],
}: {
  items: ReviewItem[];
  januaryDue: boolean;
  /** Official pages whose content changed since we last read them. */
  movedSources?: { url: string; changedAt: string }[];
}) {
  const summary = reviewQueueSummary(items);

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
        <CalendarClock className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        בדיקת תוכן מול המקורות
        {summary.now > 0 && (
          <span className="tnum rounded-full bg-status-overdue-bg px-2 py-0.5 text-xs font-bold text-status-overdue">
            {summary.now} לבדיקה מיידית
          </span>
        )}
      </h2>

      {januaryDue && (
        <div className="mb-3 flex gap-2.5 rounded-2xl border border-status-progress/30 bg-status-progress-bg p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-progress" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-soft">
            <b>עדכון סכומים שנתי.</b> תחילת השנה — הסכומים לשנת המס החדשה מתפרסמים
            עכשיו. עד שיעודכנו בטבלת הסכומים, המשתמשים רואים את סכומי השנה הקודמת.
          </p>
        </div>
      )}

      {/* The other half of change detection. The queue above knows what is OLD;
          this knows what MOVED — a rule can change the week after it was
          reviewed and stay "fresh" for a year. */}
      {movedSources.length > 0 && (
        <div className="mb-3 rounded-2xl border border-status-overdue/30 bg-status-overdue-bg/40 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-overdue" aria-hidden />
            {movedSources.length} מקורות רשמיים השתנו
          </p>
          <p className="mb-2.5 text-xs leading-relaxed text-ink-muted">
            הדפים האלה שונים ממה שקראנו מהם. זה לא אומר שהחוק השתנה — צריך לקרוא
            ולאשר. התוכן לא מתעדכן אוטומטית מהסיגנל הזה.
          </p>
          <ul className="flex flex-col gap-1.5">
            {movedSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
                  dir="ltr"
                >
                  {s.url}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-edge bg-card p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-done" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-soft">
            כל התוכן נבדק מול המקורות הרשמיים בתוך טווח הבדיקה. אין כרגע טענה
            משפטית שאי אפשר לעמוד מאחוריה.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted">
            {summary.unsourcedStatuteClaims > 0 ? (
              <>
                <b className="text-ink">{summary.unsourcedStatuteClaims}</b> טענות
                שמוצגות למשתמשים כחובה חוקית לא נבדקו מול המקור מעל שנה.
              </>
            ) : (
              <>{summary.total} פריטים ממתינים לבדיקה תקופתית. אין טענה חוקית באיחור.</>
            )}
          </p>

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={`${item.kind}:${item.id}`}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 ${
                  item.urgency === "now"
                    ? "border-status-overdue/30 bg-status-overdue-bg/40"
                    : "border-edge bg-card"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">{item.title}</span>
                    <span className="rounded-full border border-edge-soft bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
                      {item.kind === "figure" ? "סכום" : BASIS_LABEL[item.legalBasis]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        item.urgency === "now"
                          ? "bg-status-overdue-bg text-status-overdue"
                          : "bg-surface-2 text-ink-muted"
                      }`}
                    >
                      {URGENCY_LABEL[item.urgency]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">{item.reason}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted" dir="ltr">
                    {item.id}
                  </p>
                </div>
                {item.source && (
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                  >
                    למקור
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
