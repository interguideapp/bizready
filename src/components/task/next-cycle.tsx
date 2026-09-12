import { daysUntilIso, distanceLabel } from "@/lib/he-distance";
import { AlertTriangle, CalendarClock, History, RefreshCw } from "lucide-react";
import type { CycleReason } from "@/lib/cycles";

/**
 * What happens after this one — and why it is open again.
 *
 * A recurring duty used to end at "בוצע". Nothing on the screen said when the
 * next report was due, nothing said the previous one had been kept, and when
 * the task reopened it reopened silently — so it read as if the product had
 * forgotten work the user remembered doing. Both halves are stated here:
 * cycles.ts decides, this says it out loud.
 */

export interface CycleNote {
  reason: CycleReason;
  dueIso: string;
  periodLabel: string | null;
  /** True when its deadline has already arrived. */
  open: boolean;
}

function heDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("he-IL");
}

/**
 * How far away, from the one shared vocabulary.
 *
 * This started as a fifth private copy of the same phrasing. Looking at it in a
 * browser is what caught it: the card said "באיחור 60 ימים" while the
 * obligations board, two taps away, said "באיחור כחודשיים" about the same day
 * count. See he-distance.ts.
 */
export function whenPhrase(iso: string, todayIso: string): string {
  return distanceLabel(daysUntilIso(iso, todayIso));
}

/**
 * The reopening, explained.
 *
 * Shown only when the task is open again after having been closed. Saying why
 * is the whole point: un-ticking something without a reason is worse than
 * leaving it ticked.
 */
export function ReopenedNote({ cycle, todayIso }: { cycle: CycleNote; todayIso: string }) {
  const days = daysUntilIso(cycle.dueIso, todayIso);
  const late = days < 0;
  return (
    <div
      className={`mb-4 rounded-2xl border p-4 ${
        late
          ? "border-status-overdue/40 bg-status-overdue/5"
          : "border-edge bg-surface/60"
      }`}
    >
      <h2
        className={`mb-1 flex items-start gap-2 text-section ${
          late ? "text-status-overdue" : "text-ink"
        }`}
      >
        {late ? (
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
        ) : cycle.reason === "renewal" ? (
          <RefreshCw className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" aria-hidden />
        ) : (
          <CalendarClock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" aria-hidden />
        )}
        {cycle.reason === "renewal"
          ? "הגיע מועד החידוש"
          : cycle.reason === "period"
            ? cycle.periodLabel
              ? `תקופת הדיווח ${cycle.periodLabel} פתוחה`
              : "תקופת דיווח חדשה פתוחה"
            : "המשימה חזרה לפי המחזוריות"}
      </h2>
      <p className="text-xs leading-relaxed text-ink-soft">
        {cycle.reason === "renewal"
          ? // "כדאי לחדש לפני המועד" is advice you can no longer take once the
            // date has arrived, and this card only ever shows on or after it.
            days === 0
            ? `התוקף נגמר היום, לפי התאריך שרשמתם. חידוש עכשיו מונע יום בלי כיסוי.`
            : `התוקף נגמר ב-${heDate(cycle.dueIso)}, לפי התאריך שרשמתם — ${whenPhrase(cycle.dueIso, todayIso)}. כל יום עד החידוש הוא יום בלי כיסוי.`
          : `מועד ההגשה ${heDate(cycle.dueIso)} — ${whenPhrase(cycle.dueIso, todayIso)}.`}
      </p>
      {/* The user remembers finishing this. Say that it was kept — and in the
          words that fit: a renewed policy is not a "reporting period". */}
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
        <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {cycle.reason === "renewal"
          ? "מה שסיימתם קודם נשמר — זה חידוש של אותו כיסוי, לא משימה מאיפוס."
          : "מה שסיימתם קודם נשמר — זאת תקופה חדשה, לא איפוס."}
      </p>
    </div>
  );
}

/**
 * What is coming next, on a task that is closed and up to date.
 *
 * The answer to "so when is the next one" without having to go and look at the
 * board, which is where a user who has just filed actually asks it.
 */
export function NextCycleNote({ cycle, todayIso }: { cycle: CycleNote; todayIso: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-edge bg-surface/60 p-4">
      <h2 className="mb-1 flex items-start gap-2 text-section text-ink">
        {cycle.reason === "renewal" ? (
          <RefreshCw className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" aria-hidden />
        ) : (
          <CalendarClock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-400" aria-hidden />
        )}
        מה הלאה
      </h2>
      <p className="text-xs leading-relaxed text-ink-soft">
        {cycle.reason === "renewal" ? (
          <>
            החידוש הבא ב-<span className="font-semibold text-ink">{heDate(cycle.dueIso)}</span>
            {" · "}
            {whenPhrase(cycle.dueIso, todayIso)}. נזכיר לכם לפני.
          </>
        ) : cycle.reason === "period" ? (
          <>
            {cycle.periodLabel ? `תקופת הדיווח הבאה: ${cycle.periodLabel}. ` : "התקופה הבאה. "}
            להגשה עד <span className="font-semibold text-ink">{heDate(cycle.dueIso)}</span>
            {" · "}
            {whenPhrase(cycle.dueIso, todayIso)}.
          </>
        ) : (
          <>
            חוזר ב-<span className="font-semibold text-ink">{heDate(cycle.dueIso)}</span>
            {" · "}
            {whenPhrase(cycle.dueIso, todayIso)}.
          </>
        )}
      </p>
    </div>
  );
}
