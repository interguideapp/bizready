/**
 * One shape check for an email address.
 *
 * FOUR COPIES EXISTED AND ONE WAS DEAD. actions.ts validated the public
 * partner-application form with a class that had lost its backslash level, so
 * it read as "not the letter s, not @" instead of "not whitespace, not @". The
 * consequence is absurd and was live: it rejected every address containing the
 * letter s. moshe@business.co.il, yossi@post.co.il, anything at a domain with
 * an s in it — all told "כתובת האימייל לא נראית תקינה", which is a valid
 * address being turned away from a public funnel.
 *
 * The other three copies were correct, which is exactly why nobody noticed:
 * the same expression, spelled right in three places and wrong in the fourth.
 * Same family as the two dead validators in markPeriodFiled and
 * setTaskDueDate, and the same remedy — one definition, exported, tested
 * against real values rather than only read.
 *
 * A SHAPE CHECK, not a verdict on deliverability. We are not the authority on
 * what address exists; an entry with no "@" is certainly not one.
 */

/**
 * Written as a single literal in one reviewable place.
 *
 * The class cannot be expressed without escapes, so the protection is the test
 * beside it: it asserts real addresses pass, including ones holding every
 * letter the mangled versions choked on, and that the mangled forms fail.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed and lowercased, which is how an address is compared and stored. */
export function normaliseEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function looksLikeEmailAddress(email: string): boolean {
  return EMAIL_SHAPE.test(normaliseEmailAddress(email));
}
