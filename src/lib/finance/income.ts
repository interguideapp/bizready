/** Manual monthly income — the pure shaping shared by the server page and the client logger. */

import { israelParts } from "@/lib/dates";
import { monthKey } from "@/lib/finance/revenue-months";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export interface IncomeMonth {
  key: string; // yyyy-mm
  label: string; // "אוגוסט 2026"
  amount: number;
}

/** The last `count` months (oldest→newest), seeded from known amounts by yyyy-mm. */
export function buildIncomeMonths(
  amountsByKey: Record<string, number>,
  count = 6,
  now = new Date()
): IncomeMonth[] {
  /*
   * THE WINDOW IS ISRAEL'S MONTH, not the server's.
   *
   * This read now.getFullYear()/getMonth() — the host clock. Israel is UTC+2/+3,
   * so from Israeli midnight until 02:00/03:00 on the 1st, a UTC server is
   * still in the PREVIOUS month: the newest row offered was last month, and
   * someone typing "this month's income" wrote it into the wrong month.
   *
   * That is not a cosmetic label. These amounts are stored as manual_revenue,
   * summed into the עוסק פטור ceiling calculation and the twelve-month chart,
   * so a misfiled month shifts a figure the product warns people about. It is
   * also the one place the user is TYPING the number, which makes a wrong
   * label the most believable kind of wrong.
   *
   * Same key builder as the revenue map, so the row a person fills in and the
   * bucket it is later read from cannot be spelled differently — which is
   * exactly how the "מחזור החודש" figure came to be permanently ₪0.
   */
  const here = israelParts(now);
  const out: IncomeMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    // Built in UTC so the month arithmetic cannot re-enter the host zone.
    const d = new Date(Date.UTC(here.year, here.month - i, 1));
    const key = monthKey(d.getUTCFullYear(), d.getUTCMonth());
    out.push({
      key,
      label: `${HE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      amount: amountsByKey[key] ?? 0,
    });
  }
  return out;
}
