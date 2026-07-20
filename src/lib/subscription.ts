import type { BusinessRow } from "@/lib/data";

/**
 * Whether the business currently has active Pro (the Compliance Guardian).
 * A trial with a future `subscription_until` still counts as Pro.
 */
export function isPro(
  business: Pick<BusinessRow, "subscription_tier" | "subscription_until">
): boolean {
  if (business.subscription_tier !== "pro") return false;
  if (!business.subscription_until) return true;
  return new Date(business.subscription_until) > new Date();
}

/** What Pro unlocks — shown on the paywall. */
export const PRO_FEATURES = [
  "לוח שנה מלא של כל החובות והחידושים העתידיים",
  "תזכורות מסלימות: 30 / 14 / 7 יום ויום לפני — בכל הערוצים",
  "מעקב תפוגת מסמכים וחידושי ביטוח/רישיון אוטומטי",
  "התראה חיה על התקרבות לתקרת עוסק פטור",
] as const;

export const TRIAL_DAYS = 14;
