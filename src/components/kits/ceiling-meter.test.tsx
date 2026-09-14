// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { CeilingMeter } from "./ceiling-meter";
import { parseIls } from "@/lib/money";

/**
 * THE METER READ 0% FOR SOMEONE ₪833 FROM THE CEILING.
 *
 * Turnover was parsed with `Number(turnover) || 0`. Number("122,000") is NaN,
 * and the `|| 0` turned that into zero — so a user who typed their turnover
 * the way Hebrew writes it, with a thousands separator, and the way this very
 * component RENDERS money via formatIls, saw 0%, a green bar and "safe".
 *
 * That is the dangerous direction, and this codebase says so in as many words
 * elsewhere: understating the ceiling tells someone they have room when they
 * have crossed the line. parseIls was written for exactly this — "people paste
 * amounts... silently reading an empty field as zero shekels is how a blank
 * price becomes a free service" — and was called by nothing.
 *
 * The field was also type="number", which makes the BROWSER blank a value
 * containing a comma, reaching the same zero by a different route. Parsing
 * without fixing the input would have proved nothing.
 */
afterEach(cleanup);

const CEILING = 122_833;

async function typeTurnover(value: string) {
  render(<CeilingMeter ceiling={CEILING} />);
  const field = screen.getByRole("textbox");
  await userEvent.type(field, value);
  return field;
}

describe("a thousands separator is read, not discarded", () => {
  it("the premise: the field accepts the characters at all", async () => {
    // type="number" silently dropped them, so the parse could never see them.
    const field = await typeTurnover("122,000");
    expect((field as HTMLInputElement).value).toBe("122,000");
  });

  it("shows the real percentage instead of 0%", async () => {
    await typeTurnover("122,000");
    const text = document.body.textContent ?? "";
    // 122,000 / 122,833 = 99%
    expect(text).toMatch(/99%/);
    expect(text).not.toMatch(/\b0%/);
  });

  it("accepts a pasted shekel sign too", async () => {
    await typeTurnover("₪122,000");
    expect(document.body.textContent ?? "").toMatch(/99%/);
  });

  it("still reads a plain number", async () => {
    await typeTurnover("45000");
    expect(document.body.textContent ?? "").toMatch(/37%/);
  });
});

describe("an unreadable amount is said, not shown as zero", () => {
  it("names the problem and how to write it", async () => {
    await typeTurnover("בערך מאה אלף");
    expect(document.body.textContent ?? "").toMatch(/לא הצלחנו לקרוא את הסכום/);
  });

  it("marks the field invalid for a screen reader", async () => {
    const field = await typeTurnover("abc");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("says nothing at all before anything is typed", async () => {
    // Empty is the starting state and means nothing yet — quite different from
    // a value we could not read, which is the distinction parseIls preserves
    // by returning null rather than 0.
    render(<CeilingMeter ceiling={CEILING} />);
    expect(document.body.textContent ?? "").not.toMatch(/לא הצלחנו לקרוא/);
  });
});

describe("the parser and the formatter agree about the same string", () => {
  it("what formatIls renders, parseIls reads back", () => {
    // The round trip that was broken: the component displayed ₪122,833 and
    // could not read ₪122,833.
    for (const amount of [0, 45_000, 122_833, 1_200.5]) {
      const rendered = new Intl.NumberFormat("he-IL").format(amount);
      expect(parseIls(rendered), rendered).toBe(amount);
      expect(parseIls("₪" + rendered), rendered).toBe(amount);
    }
  });
});
