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

/**
 * How long, on its own, with no claim attached.
 *
 * Separated from lateLabel because "באיחור" is a claim: it says a deadline was
 * missed. An insurance policy that expired three months ago missed no deadline
 * — there is simply no cover — and the obligations board needs the same
 * duration vocabulary with a different sentence around it.
 */
export function durationLabel(days: number): string {
  if (days <= 1) return "יום";
  if (days === 2) return "יומיים";
  if (days < 60) return `${days} ימים`;
  const months = Math.floor(days / 30);
  if (months >= 12) return "למעלה משנה";
  if (months === 2) return "כחודשיים";
  return `כ-${months} חודשים`;
}

/** How late, given a POSITIVE number of days past the deadline. */
export function lateLabel(days: number): string {
  return `באיחור ${durationLabel(days)}`;
}

/**
 * How long a cover has been expired.
 *
 * Not "באיחור": nothing was filed late and no authority is charging interest.
 * What is true is that the cover ran out and has been out for this long.
 */
export function lapsedLabel(days: number): string {
  return `פג לפני ${durationLabel(days)}`;
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

/**
 * The span a check actually covered, for a claim that must not overreach.
 *
 * The alerts list only looks as far ahead as the reminder windows allow — seven
 * days on the free plan, thirty on Pro — and its empty state said
 * "אין דדליין מתקרב". For a free business with a VAT filing twenty days out
 * that is simply false, and it is the worst sentence this product can print: a
 * clean bill of health it did not check for. Even on Pro it was false past
 * thirty days.
 *
 * So the sentence names its own horizon. Weeks and months read far better than
 * "ב-7 הימים הקרובים", and the dual forms are spelled out because a numeral 1
 * beside a plural noun is the recurring defect in this codebase.
 */
export function horizonLabel(days: number): string {
  if (days <= 1) return "ביום הקרוב";
  if (days === 2) return "ביומיים הקרובים";
  if (days === 7) return "בשבוע הקרוב";
  if (days === 14) return "בשבועיים הקרובים";
  if (days === 30 || days === 31) return "בחודש הקרוב";
  if (days === 60 || days === 61) return "בחודשיים הקרובים";
  if (days % 7 === 0 && days < 30) return `ב-${days / 7} השבועות הקרובים`;
  if (days >= 90 && days % 30 === 0) return `ב-${days / 30} החודשים הקרובים`;
  return `ב-${days} הימים הקרובים`;
}

/**
 * A COUNT WITH ITS NOUN, in a form Hebrew actually uses.
 *
 * Hebrew has a dual, and a numeral 1 beside a plural noun is simply wrong:
 * "1 משימות" reads like a machine wrote it, and "2 ימים" should be "יומיים".
 * durationLabel above has handled that for time spans since it was written —
 * and nothing outside this module ever called it, while the home screen's
 * streak tile rendered "1 ימים ברצף" to the most-read surface in the product.
 *
 * Six noun pairs were fixed one at a time in this file. This is the seventh
 * arriving, which is the point at which a helper beats another fix: the caller
 * supplies the three forms and cannot forget that there are three.
 *
 * `many` is the bare plural noun, since it is the only form that takes the
 * numeral in front of it.
 */
export interface CountForms {
  /** Exactly one, numeral spelled out: "משימה אחת". */
  one: string;
  /** Exactly two, the dual: "שתי משימות", "יומיים". */
  two: string;
  /** Three or more — the bare plural, which gets the numeral prefixed. */
  many: string;
}

export function countLabel(n: number, forms: CountForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return `${n} ${forms.many}`;
}

/** The three forms for a count of tasks, which several surfaces need. */
export const TASK_FORMS: CountForms = {
  one: "משימה אחת",
  two: "שתי משימות",
  many: "משימות",
};

/** Artefacts recorded on the business certificate — "פרט אחד", "23 פרטים". */
export const DETAIL_FORMS: CountForms = {
  one: "פרט אחד",
  two: "שני פרטים",
  many: "פרטים",
};
