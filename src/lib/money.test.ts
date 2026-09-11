import { describe, expect, it } from "vitest";
import { formatIls, formatIlsRounded, parseIls } from "./money";

describe("formatIls keeps what the user typed", () => {
  it("preserves agorot when they exist", () => {
    // The bug this replaces: eight copies of the formatter did
    // Math.round(n) first, so a price list entry of ₪49.90 was rendered back to
    // the user as ₪50. The product silently altered a number they entered.
    expect(formatIls(49.9)).toBe("₪49.90");
    expect(formatIls(1234.56)).toBe("₪1,234.56");
  });

  it("omits them when the amount is whole", () => {
    // Not "₪50.00" — trailing zeros on a whole price are noise.
    expect(formatIls(50)).toBe("₪50");
    expect(formatIls(122833)).toBe("₪122,833");
  });

  it("gives two decimals rather than one", () => {
    // 49.9 formatted with maximumFractionDigits alone yields "₪49.9", which
    // reads as a typo.
    expect(formatIls(49.9)).toBe("₪49.90");
    expect(formatIls(0.5)).toBe("₪0.50");
  });

  it("groups thousands the he-IL way", () => {
    expect(formatIls(1000000)).toBe("₪1,000,000");
  });

  it("rounds only when asked", () => {
    expect(formatIls(49.9, { round: true })).toBe("₪50");
    expect(formatIlsRounded(1234.56)).toBe("₪1,235");
  });

  it("can omit the sign for a column already headed with it", () => {
    expect(formatIls(250, { bare: true })).toBe("250");
  });

  it("handles zero as zero, not as absent", () => {
    // A cost of ₪0 is a real statement; it must not render as "—".
    expect(formatIls(0)).toBe("₪0");
  });

  it("renders an em dash for a missing amount", () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      expect(formatIls(value as number), String(value)).toBe("—");
    }
  });

  it("keeps negatives legible, LRM included", () => {
    // he-IL emits a left-to-right mark (U+200E) before the minus sign, and that
    // is correct rather than stray: without it the minus renders on the wrong
    // side of the digits in RTL text and "-250" reads as "250-". So the test
    // asserts the mark is there instead of stripping it.
    expect(formatIls(-250)).toBe("₪‎-250");
    expect(formatIls(-250).replace(/‎/g, "")).toBe("₪-250");
  });
});

describe("parseIls", () => {
  it("reads what people actually paste", () => {
    expect(parseIls("₪1,234.56")).toBe(1234.56);
    expect(parseIls("  250 ")).toBe(250);
    expect(parseIls("1,000")).toBe(1000);
  });

  it("returns null for an empty field rather than zero", () => {
    // Number("") is 0, and reading a blank price as zero shekels is how a blank
    // field becomes a free service.
    expect(parseIls("")).toBeNull();
    expect(parseIls("   ")).toBeNull();
  });

  it("returns null for anything that is not a number", () => {
    for (const bad of ["abc", "₪", "1.2.3", "--5"]) {
      expect(parseIls(bad), bad).toBeNull();
    }
  });

  it("round-trips through formatIls", () => {
    for (const value of [0, 49.9, 250, 1234.56, 122833]) {
      expect(parseIls(formatIls(value)), String(value)).toBe(value);
    }
  });
});
