import { describe, expect, it } from "vitest";
import { buildIncomeMonths } from "./income";

describe("buildIncomeMonths", () => {
  const now = new Date(2026, 8, 15); // Sep 2026 (month index 8)

  it("returns the last N months oldest→newest, ending on the current month", () => {
    const months = buildIncomeMonths({}, 6, now);
    expect(months).toHaveLength(6);
    expect(months[0].key).toBe("2026-04");
    expect(months[5].key).toBe("2026-09");
    expect(months[5].label).toBe("ספטמבר 2026");
    expect(months.every((m) => m.amount === 0)).toBe(true);
  });

  it("seeds known amounts by yyyy-mm and leaves the rest at 0", () => {
    const months = buildIncomeMonths({ "2026-08": 12000, "2026-09": 4500 }, 6, now);
    expect(months.find((m) => m.key === "2026-08")!.amount).toBe(12000);
    expect(months.find((m) => m.key === "2026-09")!.amount).toBe(4500);
    expect(months.find((m) => m.key === "2026-07")!.amount).toBe(0);
  });

  it("crosses a year boundary correctly", () => {
    const months = buildIncomeMonths({}, 3, new Date(2026, 1, 10)); // Feb 2026
    expect(months.map((m) => m.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
