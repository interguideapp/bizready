import { Gauge } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * What the readiness number is made of.
 *
 * Extracted because the bar and the label beside it measured DIFFERENT THINGS
 * and were read as one. The bar's width is the weighted score — priority-
 * weighted, with half credit for a task in progress — while the label was a raw
 * count of fully-done tasks. So a category holding two tasks, both in progress,
 * drew a half-full bar next to the text "0/2". Two numbers about the same
 * category, side by side, disagreeing, in the one panel whose job is to explain
 * the score.
 *
 * Now the bar carries its own value and the count says what it counts.
 */

export interface CategoryReadiness {
  categoryId: string;
  title: string;
  /** The weighted score, 0-100. What the bar draws. */
  score: number;
  /** Fully-done tasks. A different measure, and labelled as one. */
  done: number;
  total: number;
}

/** "נותרה אחת" / "נותרו 4" — the count of what is left, in Hebrew that survives one. */
export function remainingText(remaining: number): string {
  if (remaining === 1) return "נותרה אחת";
  if (remaining === 2) return "נותרו שתיים";
  return `נותרו ${remaining}`;
}

export function ReadinessByCategory({
  overall,
  categories,
  weakest,
}: {
  overall: number;
  categories: CategoryReadiness[];
  /** The few dragging the number down, so it is explainable rather than shown. */
  weakest: CategoryReadiness[];
}) {
  return (
    <Card className="h-full p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-section text-ink">
          <Gauge className="h-4.5 w-4.5 text-brand-400" aria-hidden />
          היערכות לפי תחום
        </h2>
        <span className="tnum text-sm text-ink-muted">
          ציון כולל <b className="text-ink">{overall}</b>
        </span>
      </div>

      {/* A bare number invites the reader to treat it as a verdict. This says
          what is behind it, which is the only part they can act on. */}
      {weakest.length > 0 && (
        <p className="mb-3 text-xs leading-relaxed text-ink-muted">
          מה שמוריד אותו עכשיו:{" "}
          {weakest.map((c, i) => (
            <span key={c.categoryId}>
              {i > 0 && ", "}
              <b className="font-medium text-ink-soft">{c.title}</b>{" "}
              ({remainingText(c.total - c.done)})
            </span>
          ))}
          .
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {categories.map((c) => (
          <div key={c.categoryId}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-soft">{c.title}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {/* The bar's own value, so the two agree. */}
                <b className="tnum font-medium text-ink-soft">{c.score}%</b>
                {" · "}
                {/* And the count, with the noun that says what it counts —
                    without it the fraction reads as the bar's value, which is
                    how a half-full bar came to sit beside "0/2". */}
                <span className="tnum">
                  {c.done}/{c.total} משימות
                </span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-track"
              role="progressbar"
              aria-valuenow={c.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`היערכות ${c.title}`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400"
                style={{ width: `${c.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
