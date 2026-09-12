/**
 * How far away a date is, in words a person would use.
 *
 * There were four copies of this and they disagreed about the same fact:
 *
 *   badges.tsx        a binary "עבר המועד" — five days late and a hundred and
 *                     sixty-five read identically, on the badge that appears on
 *                     every task row
 *   calendar/sections the month-aware version, with the Hebrew dual
 *   insights/lead     raw day counts both ways
 *   task/next-cycle   a fifth, written for the cycle notes
 *
 * So "how late am I" had a different answer depending on which screen the user
 * happened to be looking at, which is the same class of defect as two engines
 * disagreeing about whether a filing is overdue — just in the copy layer.
 *
 * Hebrew has a dual, so "2 ימים" and "כ-2 חודשים" are the
 * translated-from-English texture the product has been clearing out. Past a
 * couple of months the day count stops meaning anything and the month count
 * starts, so it switches; past a year no number helps at all.
 */

/** How late, given a POSITIVE number of days past the deadline. */
export function lateLabel(days: number): string {
  if (days <= 1) return "באיחור יום";
  if (days === 2) return "באיחור יומיים";
  if (days < 60) return `באיחור ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months >= 12) return "באיחור למעלה משנה";
  if (months === 2) return "באיחור כחודשיים";
  return `באיחור כ-${months} חודשים`;
}

/** How far ahead, given a NON-NEGATIVE number of days until the deadline. */
export function aheadLabel(days: number): string {
  if (days <= 0) return "היום";
  if (days === 1) return "מחר";
  if (days === 2) return "מחרתיים";
  if (days < 60) return `בעוד ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months >= 12) return "בעוד למעלה משנה";
  if (months === 2) return "בעוד כחודשיים";
  return `בעוד כ-${months} חודשים`;
}

/**
 * The signed version: negative is late, zero is today, positive is ahead.
 *
 * This is the shape every caller actually has, because `daysUntil` is what the
 * obligations engine returns.
 */
export function distanceLabel(daysUntil: number): string {
  return daysUntil < 0 ? lateLabel(-daysUntil) : aheadLabel(daysUntil);
}

/** Whole days from today to an ISO date. Negative once the date is behind us. */
export function daysUntilIso(iso: string, todayIso: string): number {
  return Math.round(
    (new Date(iso + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) /
      86_400_000
  );
}
