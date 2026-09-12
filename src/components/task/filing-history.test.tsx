// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FilingHistory, formatIls, type FilingEntry } from "./filing-history";

/**
 * The filing record, on screen.
 *
 * Migration 030 recorded every filing since it shipped and nothing displayed
 * it, so the only evidence a user had that they filed Jul–Aug was their own
 * memory — which is what a compliance tool exists to replace.
 */

afterEach(cleanup);

function entry(over: Partial<FilingEntry> = {}): FilingEntry {
  return {
    periodKey: "2026-07..2026-08",
    periodLabel: "יולי–אוגוסט 2026",
    dueIso: "2026-09-15",
    filedAt: "2026-09-12T10:30:00Z",
    amount: "4210",
    reference: "884512003",
    ...over,
  };
}

describe("what the record says", () => {
  it("names the period, when it was filed, what was paid and the reference", () => {
    render(<FilingHistory entries={[entry()]} />);
    expect(screen.getByText("יולי–אוגוסט 2026")).toBeDefined();
    expect(screen.getByText(/הוגש 12.9.2026/)).toBeDefined();
    expect(screen.getByText("4,210 ₪")).toBeDefined();
    expect(screen.getByText("884512003")).toBeDefined();
  });

  it("says the record is not erasable, because 030 grants no DELETE", () => {
    // A user deciding whether to trust this needs to know it is a record and
    // not a list they could have edited.
    render(<FilingHistory entries={[entry()]} />);
    expect(screen.getByText(/אינו נמחק/)).toBeDefined();
  });

  it("falls back to the stored key when the period has no name", () => {
    // The key is authoritative and the label is presentation; a period shape
    // the rule cannot name still has to be identifiable.
    render(<FilingHistory entries={[entry({ periodLabel: null })]} />);
    expect(screen.getByText("2026-07..2026-08")).toBeDefined();
  });

  it("does not let bidi reverse a raw period key", () => {
    // Seen in a browser: 2026-01..2026-12 rendered as "2026-12..2026-01",
    // which reads as a period running from December to January. Two Latin runs
    // around ".." get reordered inside an RTL line, and a reversed identifier
    // is worse than an ugly one.
    render(
      <FilingHistory
        entries={[entry({ periodKey: "2026-01..2026-12", periodLabel: null })]}
      />
    );
    expect(screen.getByText("2026-01..2026-12").getAttribute("dir")).toBe("ltr");
  });

  it("shows a period with no amount or reference without empty furniture", () => {
    // Periods cleared from the board with "כבר הגשתי" carry neither.
    render(<FilingHistory entries={[entry({ amount: null, reference: null })]} />);
    expect(screen.getByText("יולי–אוגוסט 2026")).toBeDefined();
    expect(screen.queryByText(/אסמכתא/)).toBeNull();
  });

  it("renders nothing at all with no history", () => {
    // Not an empty card: "no filings on record" is the default state for every
    // new business and says nothing worth a heading.
    const { container } = render(<FilingHistory entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("counts in the singular for one", () => {
    render(<FilingHistory entries={[entry()]} />);
    expect(screen.getByText(/תקופה אחת רשומה/)).toBeDefined();
  });

  it("keeps a reference number in Latin order inside the Hebrew line", () => {
    // Without dir="ltr" a confirmation number reorders in an RTL paragraph, and
    // a reference the user cannot read back is not evidence.
    render(<FilingHistory entries={[entry()]} />);
    expect(screen.getByText("884512003").getAttribute("dir")).toBe("ltr");
  });
});

describe("money, in Hebrew", () => {
  it("puts the shekel sign after the number, where Hebrew puts it", () => {
    expect(formatIls("4210")).toBe("4,210 ₪");
  });

  it("keeps agorot only when they are not zero", () => {
    // "4,210.00 ₪" reads like a database field.
    expect(formatIls("4210.00")).toBe("4,210 ₪");
    // And when they exist they get both digits: 50 agorot is .50, not .5.
    expect(formatIls("4210.5")).toBe("4,210.50 ₪");
    expect(formatIls("4210.07")).toBe("4,210.07 ₪");
  });

  it("returns nothing for a value that is not a number", () => {
    // The field is free text at the database boundary, whatever the input type.
    expect(formatIls("בערך אלפיים")).toBeNull();
  });
});
