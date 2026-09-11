/**
 * How old the legal review of a piece of content is.
 *
 * Every template carries `last_reviewed`, and until now not one line of code
 * read it. That is the difference between a compliance product and a blog: a
 * user cannot tell whether "₪122,833" is this year's number or a number someone
 * typed in once, and the team has no way to notice when a rule has moved.
 *
 * This module is deliberately small and pure so the thresholds are visible,
 * testable, and identical everywhere — the task page, the review queue and any
 * future source-watching job all ask the same question here.
 */

/** Past this age, content is presented as unverified rather than current. */
export const STALE_AFTER_MONTHS = 12;
/** Past this age, content is still shown plainly but flagged for review. */
export const AGING_AFTER_MONTHS = 9;

export type ReviewState = "fresh" | "aging" | "stale" | "unknown";

export interface ReviewAge {
  state: ReviewState;
  /** Whole months since the review date. Null when the date is unusable. */
  months: number | null;
  /** The parsed review date, echoed back for display. Null when unusable. */
  reviewedOn: string | null;
}

/**
 * Months between two ISO dates, counting only whole months elapsed.
 *
 * Uses UTC parts rather than Date arithmetic: a month is not a fixed number of
 * days, and the app's dates are calendar dates, not instants.
 */
function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1; // the current month has not completed yet
  return months;
}

/**
 * Classifies a template's review date against today.
 *
 * A missing or malformed date returns `unknown` rather than `fresh`. This matters:
 * the failure mode of a content-review system must never be to silently claim
 * that unreviewed content is current — that is the same "reassuring in the wrong
 * direction" failure the rest of this codebase has been fixing.
 *
 * A future review date is treated as fresh with `months: 0` rather than as an
 * error; it means someone stamped a review ahead of time, which is harmless.
 */
export function reviewAge(lastReviewed: string | null | undefined, todayIso: string): ReviewAge {
  if (!lastReviewed || !/^\d{4}-\d{2}-\d{2}$/.test(lastReviewed)) {
    return { state: "unknown", months: null, reviewedOn: null };
  }
  const months = Math.max(0, wholeMonthsBetween(lastReviewed, todayIso));
  const state: ReviewState =
    months >= STALE_AFTER_MONTHS ? "stale" : months >= AGING_AFTER_MONTHS ? "aging" : "fresh";
  return { state, months, reviewedOn: lastReviewed };
}

/**
 * What to tell the user, if anything. Returns null when the content is fresh —
 * a banner on every task would train people to ignore it.
 */
export function stalenessNotice(age: ReviewAge): string | null {
  switch (age.state) {
    case "stale":
      return "המידע במשימה הזאת לא נבדק מול המקור הרשמי מעל שנה. ייתכן שסכומים, מועדים או נהלים השתנו — בדקו בקישור הרשמי לפני שאתם מסתמכים עליו.";
    case "aging":
      return "המידע כאן ממתין לבדיקה תקופתית. הוא עדיין אמור להיות מעודכן, אבל שווה לאמת סכומים ומועדים בקישור הרשמי.";
    case "unknown":
      return "לא רשום מתי המידע הזה נבדק לאחרונה מול המקור הרשמי. התייחסו אליו כאל מידע כללי ואמתו בקישור הרשמי.";
    default:
      return null;
  }
}

/** dd.mm.yyyy — the form Israeli users read dates in. */
export function formatReviewDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
