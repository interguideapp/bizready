// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReadinessByCategory, remainingText, type CategoryReadiness } from "./readiness";

/**
 * The panel whose job is to explain the readiness number.
 *
 * The bar's width and the label beside it measured DIFFERENT THINGS and were
 * read as one. The bar draws the weighted score — priority-weighted, half
 * credit for a task in progress — while the label was a raw count of fully-done
 * tasks. So a category holding two tasks, both in progress, drew a half-full
 * bar next to the text "0/2".
 */
afterEach(cleanup);

const cat = (over: Partial<CategoryReadiness> = {}): CategoryReadiness => ({
  categoryId: "tax",
  title: "מיסים",
  score: 50,
  done: 0,
  total: 2,
  ...over,
});

describe("the bar and the numbers beside it agree", () => {
  it("shows the bar's own value, not only a task count", () => {
    // The exact shape of the old contradiction: half-full bar, "0/2" label.
    render(<ReadinessByCategory overall={50} categories={[cat()]} weakest={[]} />);
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("gives the bar an accessible value matching its width", () => {
    render(<ReadinessByCategory overall={50} categories={[cat({ score: 73 })]} weakest={[]} />);
    const bar = screen.getByRole("progressbar", { name: "היערכות מיסים" });
    expect(bar.getAttribute("aria-valuenow")).toBe("73");
  });

  it("says what the fraction counts, so it is not read as the score", () => {
    // Without the noun, "0/2" sits where a percentage's value label goes.
    render(<ReadinessByCategory overall={50} categories={[cat()]} weakest={[]} />);
    expect(screen.getByText("0/2 משימות")).toBeDefined();
  });

  it("keeps them distinguishable when they happen to disagree most", () => {
    // 1 of 4 done but a high weighted score: the critical one is finished.
    render(<ReadinessByCategory overall={60} categories={[cat({ score: 60, done: 1, total: 4 })]} weakest={[]} />);
    expect(screen.getByText("60%")).toBeDefined();
    expect(screen.getByText("1/4 משימות")).toBeDefined();
  });
});

describe("what is dragging the number down", () => {
  it("names the categories rather than only showing a number", () => {
    render(
      <ReadinessByCategory
        overall={50}
        categories={[cat()]}
        weakest={[cat({ done: 1, total: 4 })]}
      />
    );
    expect(screen.getByText(/מה שמוריד אותו עכשיו/)).toBeDefined();
  });

  it("does not say '(1 שנותרו)'", () => {
    // The dual problem again, in yet another pair of words. One task left is
    // "נותרה אחת".
    render(
      <ReadinessByCategory
        overall={50}
        categories={[cat()]}
        weakest={[cat({ done: 3, total: 4 })]}
      />
    );
    expect(screen.getByText(/נותרה אחת/)).toBeDefined();
    expect(screen.queryByText(/1 שנותרו/)).toBeNull();
  });

  it("says nothing at all when nothing is weak", () => {
    render(<ReadinessByCategory overall={100} categories={[cat({ score: 100, done: 2 })]} weakest={[]} />);
    expect(screen.queryByText(/מה שמוריד/)).toBeNull();
  });
});

describe("the remaining count, in Hebrew", () => {
  it("uses the singular and the dual before counting", () => {
    expect(remainingText(1)).toBe("נותרה אחת");
    expect(remainingText(2)).toBe("נותרו שתיים");
    expect(remainingText(5)).toBe("נותרו 5");
  });

  it("never pairs a numeral 1 or 2 with the plural verb", () => {
    for (let n = 1; n <= 60; n++) {
      expect(remainingText(n), String(n)).not.toMatch(/^נותרו [12]$/);
    }
  });
});
