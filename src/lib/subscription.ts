import type { BusinessRow } from "@/lib/data";

/**
 * Whether the business currently has active Pro (the Compliance Guardian).
 * A trial with a future `subscription_until` still counts as Pro.
 *
 * Derived from subscriptionStanding rather than recomputed, so the gate and the
 * banner that explains it can never disagree. They did briefly: this compared
 * dates directly, and `new Date("nonsense") > new Date()` is false, so an
 * unreadable period end REVOKED a paying customer while the banner called them
 * active. periodEndIso already settles which way that should go — "an
 * unreadable period end returns null and the caller keeps the existing window
 * rather than shortening it" — and only the Stripe webhook can write these
 * columns at all (migration 019 blocks every session), so treating a bad value
 * as still-paid cannot be used to grant anyone Pro.
 */
export function isPro(
  business: Pick<BusinessRow, "subscription_tier" | "subscription_until">,
  now: Date = new Date()
): boolean {
  const { state } = subscriptionStanding(business, now);
  return state === "active" || state === "ending_soon";
}

/** What Pro unlocks — shown on the paywall. */
export const PRO_FEATURES = [
  "לוח שנה מלא של כל החובות והחידושים העתידיים",
  // Says what the runway applies to. Recommendations get a single nudge, so
  // "every deadline" would have overclaimed once that narrowed — and the
  // reason it narrowed was that four nudges per suggestion buried the filings
  // this list is selling.
  "תזכורות מסלימות על חובות והגשות: 30 / 14 / 7 יום ויום לפני — בכל הערוצים",
  "מחולל מסמכים: מדיניות פרטיות, הסכמים, הצהרת נגישות ועוד — מוכן להורדה",
  "מעקב תפוגת מסמכים וחידושי ביטוח/רישיון אוטומטי",
  "התראה חיה על התקרבות לתקרת עוסק פטור",
] as const;

export const TRIAL_DAYS = 14;

/**
 * Where the subscription's own billing period stands.
 *
 * The product tracks every one of the user's periods and, until this, none of
 * its own. `subscription_until` is the end of the CURRENT billing period —
 * periodEndIso writes it for every granting subscription, trial or paid — and
 * isPro flips to false the moment it passes. For a monthly subscriber that date
 * is about thirty days out and moves only when Stripe's renewal event arrives.
 *
 * Webhooks in this project were dead for months (proxy.ts redirected every
 * machine-called endpoint to /login), so "the renewal event did not arrive" is
 * a demonstrated failure mode, not a hypothetical. What it looked like from the
 * user's side: Pro ended, the escalating reminder windows quietly narrowed to
 * the free set, and nothing on any screen said why.
 *
 * "lapsed" is distinguishable from "never subscribed" because the tier column
 * still reads pro while the date has passed — so someone whose payment stopped
 * working gets told that, instead of the cold upgrade pitch a new user sees.
 */
export type SubscriptionState = "none" | "active" | "ending_soon" | "lapsed";

/** How close to the period end counts as worth saying out loud. */
export const ENDING_SOON_DAYS = 7;

export function subscriptionStanding(
  business: Pick<BusinessRow, "subscription_tier" | "subscription_until">,
  now: Date = new Date()
): { state: SubscriptionState; untilIso: string | null; daysLeft: number | null } {
  const untilIso = business.subscription_until;
  if (business.subscription_tier !== "pro") {
    return { state: "none", untilIso: null, daysLeft: null };
  }
  if (!untilIso) return { state: "active", untilIso: null, daysLeft: null };

  const until = new Date(untilIso);
  if (Number.isNaN(until.getTime())) {
    // An unreadable date must not read as expired: that would revoke a paying
    // customer over a parsing problem. isPro treats it the same way.
    return { state: "active", untilIso: null, daysLeft: null };
  }
  const daysLeft = Math.ceil((until.getTime() - now.getTime()) / 86_400_000);
  if (until <= now) return { state: "lapsed", untilIso, daysLeft };
  return { state: daysLeft <= ENDING_SOON_DAYS ? "ending_soon" : "active", untilIso, daysLeft };
}
