/**
 * One shekel formatter.
 *
 * There were eleven copies of this across the codebase — `const nis = (n) =>
 * "₪" + Math.round(n).toLocaleString("he-IL")` written out eight times
 * verbatim, plus three variations. Guaranteed drift, and they had already
 * drifted: the ceiling meter kept agorot while everything else rounded them
 * away.
 *
 * That rounding is the actual bug, not just the duplication. A user typing a
 * price of ₪49.90 into the price list saw it rendered back as ₪50 — the product
 * silently altered a number they had entered. For an AGGREGATE (an annual cost
 * total, a chart axis) whole shekels is right; for a value the user typed it is
 * not.
 *
 * So the default preserves agorot when they exist and omits them when the
 * amount is whole, and rounding is something a caller asks for explicitly.
 */

export interface MoneyOptions {
  /**
   * Round to whole shekels. For totals, projections and chart labels, where
   * two decimal places are noise. Never for a value the user entered.
   */
  round?: boolean;
  /** Omit the ₪ sign — for a column already headed "מחיר". */
  bare?: boolean;
}

/**
 * Formats an amount in shekels, he-IL grouped.
 *
 * The ₪ leads rather than trails. That is a deliberate choice and it disagrees
 * with strict he-IL convention, which puts the sign after the number: every
 * official Israeli source this product's content mirrors writes "₪122,833", and
 * matching the sources the user will compare against matters more here than
 * matching the locale default.
 */
export function formatIls(amount: number | null | undefined, opts: MoneyOptions = {}): string {
  if (amount == null || !Number.isFinite(amount)) return "—";

  const value = opts.round ? Math.round(amount) : amount;
  // Agorot only when they are actually there. `maximumFractionDigits: 2` with
  // `minimumFractionDigits: 0` gives ₪49.90 -> "₪49.9", which looks like a typo,
  // so a non-whole amount gets exactly two.
  const hasAgorot = !Number.isInteger(value);
  const formatted = value.toLocaleString("he-IL", {
    minimumFractionDigits: hasAgorot ? 2 : 0,
    maximumFractionDigits: hasAgorot ? 2 : 0,
  });

  return opts.bare ? formatted : `₪${formatted}`;
}

/** Whole shekels. The common case for totals and chart labels. */
export function formatIlsRounded(amount: number | null | undefined): string {
  return formatIls(amount, { round: true });
}

/**
 * Parses a user-typed amount into a number, or null.
 *
 * Accepts a leading ₪, thousands separators and surrounding whitespace, because
 * people paste amounts. Rejects anything else rather than coercing: `Number("")`
 * is 0, and silently reading an empty field as zero shekels is how a blank
 * price becomes a free service.
 */
export function parseIls(input: string): number | null {
  const cleaned = input.trim().replace(/^₪/, "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
