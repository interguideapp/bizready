/** Manual monthly income — the pure shaping shared by the server page and the client logger. */

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
  const out: IncomeMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: `${HE_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      amount: amountsByKey[key] ?? 0,
    });
  }
  return out;
}
