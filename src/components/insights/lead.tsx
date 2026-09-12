import { distanceLabel, lapsedLabel } from "@/lib/he-distance";
import Link from "next/link";
import { AlertTriangle, Flame } from "lucide-react";
import { Card } from "@/components/ui";
import { SEVERITY_LABEL, type Severity } from "@/lib/exposure";

/**
 * What תובנות opens with.
 *
 * The page used to lead with the readiness score, and that number can sit at 95
 * while a statutory filing is overdue — a filing handed to the accountant counts
 * as "waiting" and earns half credit, so the score barely moves. A page called
 * תובנות that greets you with a comfortable number while interest accrues is
 * not analysis, it is decoration.
 *
 * Extracted from the page so it can be rendered and asserted: while it lived
 * inline in a server component behind a login, the only way to check any of it
 * was to read the source.
 */

export function OverdueBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="mb-5 rounded-2xl border border-status-overdue/40 bg-status-overdue/5 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-section text-status-overdue">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        {count === 1
          ? "חובה חוקית אחת עברה את המועד"
          : `${count} חובות חוקיות עברו את המועד`}
      </h2>
      <p className="text-xs leading-relaxed text-ink-soft">
        כל עוד זה המצב, הציון למטה לא מספר את כל הסיפור — איחור צובר ריבית
        והצמדה מהיום הראשון, בלי קשר לכמה משימות אחרות הושלמו.
      </p>
      <Link
        href="/calendar"
        className="mt-2 inline-block text-xs font-semibold text-status-overdue hover:underline"
      >
        ללוח החובות ←
      </Link>
    </div>
  );
}

export interface ExposureView {
  obligationId: string;
  templateId: string | null;
  title: string;
  daysUntil: number;
  /**
   * Statutory or not. Decides the WORDS: "באיחור" is a claim that a deadline
   * was missed, which is true of a VAT period and false of an insurance policy
   * that simply ran out. The board makes the same distinction.
   */
  basis: "statutory" | "renewal";
  severity: Severity;
  consequence: string;
}

/**
 * What is most worth doing, ranked by what happens if it is ignored.
 *
 * Ranked by rankByExposure — the same engine the home screen uses, so there is
 * one ranking of consequence in the product rather than one per page.
 */
export function TopExposures({ exposures }: { exposures: ExposureView[] }) {
  if (exposures.length === 0) return null;
  return (
    <Card className="mb-5 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
        <Flame className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        מה הכי כדאי לטפל בו
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-muted">
        מדורג לפי מה שקורה אם מתעלמים — לא לפי מה שהתאריך שלו הקרוב ביותר.
      </p>
      <ul className="flex flex-col divide-y divide-edge-soft">
        {exposures.map((e) => (
          <li key={e.obligationId} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={e.templateId ? `/tasks/${e.templateId}?from=insights` : "/calendar"}
                className="text-sm font-semibold leading-snug text-ink hover:text-brand-strong"
              >
                {e.title}
              </Link>
              <span
                className={`tnum shrink-0 text-xs font-medium ${
                  e.daysUntil < 0 ? "text-status-overdue" : "text-ink-muted"
                }`}
              >
                {e.daysUntil < 0 && e.basis !== "statutory"
                  ? lapsedLabel(-e.daysUntil)
                  : distanceLabel(e.daysUntil)}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              <span className="font-medium text-ink-soft">{SEVERITY_LABEL[e.severity]}</span>
              {" · "}
              {e.consequence}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
