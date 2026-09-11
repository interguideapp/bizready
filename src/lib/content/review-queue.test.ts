import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES } from "@/lib/content";
import { FIGURES } from "@/lib/content/figures";
import { legalBasisOf } from "@/lib/content/legal-basis";
import { buildReviewQueue, januaryFiguresDue, reviewQueueSummary } from "./review-queue";

// All 70 templates currently carry a 2026-09 review date, so "today" drives
// everything. These dates are chosen relative to that.
const SOON_AFTER = "2026-09-11"; // everything fresh
const AGING = "2027-07-01"; // ~10 months on
const STALE = "2028-01-01" as const; // well over a year

describe("buildReviewQueue", () => {
  it("is empty while every claim is freshly reviewed", () => {
    // A queue that always has items in it is a queue nobody opens.
    const items = buildReviewQueue(SOON_AFTER).filter((i) => i.kind === "template");
    expect(items).toEqual([]);
  });

  it("surfaces statute claims before anything else once they age", () => {
    const items = buildReviewQueue(STALE).filter((i) => i.kind === "template");
    expect(items.length).toBeGreaterThan(0);
    // the front of the queue must be law, not marketing tips
    expect(items[0].legalBasis).toBe("statute");
    expect(items[0].urgency).toBe("now");
  });

  it("ranks by consequence, not by age", () => {
    // A stale statute task and a stale commercial task are not the same
    // problem: one is the product asserting a legal duty it has not rechecked.
    const items = buildReviewQueue(STALE).filter((i) => i.kind === "template");
    const firstCommercial = items.findIndex((i) => i.legalBasis === "commercial");
    const lastStatute = items.map((i) => i.legalBasis).lastIndexOf("statute");
    if (firstCommercial >= 0) expect(lastStatute).toBeLessThan(firstCommercial);
  });

  it("a statute claim is 'now' when stale but only 'soon' while merely aging", () => {
    const aging = buildReviewQueue(AGING).filter(
      (i) => i.kind === "template" && i.legalBasis === "statute"
    );
    expect(aging.length).toBeGreaterThan(0);
    expect(aging.every((i) => i.urgency === "soon")).toBe(true);

    const stale = buildReviewQueue(STALE).filter(
      (i) => i.kind === "template" && i.legalBasis === "statute"
    );
    expect(stale.every((i) => i.urgency === "now")).toBe(true);
  });

  it("a commercial task never reaches 'now' on age alone", () => {
    const items = buildReviewQueue(STALE).filter((i) => i.legalBasis === "commercial");
    expect(items.every((i) => i.urgency !== "now")).toBe(true);
  });

  it("every statute item points somewhere to go and check", () => {
    for (const item of buildReviewQueue(STALE)) {
      if (item.legalBasis !== "statute") continue;
      expect(item.source).toBeTruthy();
      expect(item.source).toMatch(/^https:\/\//);
    }
  });

  it("names the reason in words, not just a state", () => {
    const items = buildReviewQueue(STALE);
    expect(items.every((i) => i.reason.trim().length > 0)).toBe(true);
  });

  it("covers every template that has aged out — nothing is silently skipped", () => {
    const queued = new Set(
      buildReviewQueue(STALE).filter((i) => i.kind === "template").map((i) => i.id)
    );
    // Only commercial tasks may legitimately be absent, and only when their own
    // rule says age alone does not warrant a review.
    const missing = TASK_TEMPLATES.filter((t) => !queued.has(t.id)).map((t) => ({
      id: t.id,
      basis: legalBasisOf(t.id),
    }));
    expect(missing.filter((m) => m.basis === "statute")).toEqual([]);
  });
});

describe("figures are reviewed per tax year", () => {
  it("says nothing while the figures are for the current year", () => {
    const year = FIGURES.osekPaturCeiling.year;
    const items = buildReviewQueue(`${year}-06-15`).filter((i) => i.kind === "figure");
    expect(items).toEqual([]);
  });

  it("flags every figure as urgent the moment the tax year turns over", () => {
    // A figure from last year is a wrong number on screen right now, not a
    // scheduling matter — so it is "now" regardless of how recently the
    // surrounding template was reviewed.
    const year = FIGURES.osekPaturCeiling.year;
    const items = buildReviewQueue(`${year + 1}-01-05`).filter((i) => i.kind === "figure");
    expect(items.length).toBe(Object.keys(FIGURES).length);
    expect(items.every((i) => i.urgency === "now")).toBe(true);
    expect(items[0].reason).toContain(String(year));
  });

  it("says how many years behind, once it is more than one", () => {
    const year = FIGURES.osekPaturCeiling.year;
    const items = buildReviewQueue(`${year + 3}-01-05`).filter((i) => i.kind === "figure");
    expect(items[0].reason).toContain("3 שנים אחורה");
  });
});

describe("reviewQueueSummary", () => {
  it("counts the number that actually matters — unrechecked legal claims", () => {
    const summary = reviewQueueSummary(buildReviewQueue(STALE));
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.unsourcedStatuteClaims).toBeGreaterThan(0);
    expect(summary.now + summary.soon + summary.watch).toBe(summary.total);
  });

  it("reports zero plainly when there is nothing to do", () => {
    const year = FIGURES.osekPaturCeiling.year;
    const summary = reviewQueueSummary(buildReviewQueue(`${year}-09-11`));
    expect(summary).toMatchObject({ total: 0, now: 0, soon: 0, watch: 0 });
  });
});

describe("januaryFiguresDue", () => {
  it("is true in Jan–Feb once a figure is behind, and false otherwise", () => {
    const year = FIGURES.osekPaturCeiling.year;
    expect(januaryFiguresDue(`${year + 1}-01-10`)).toBe(true);
    expect(januaryFiguresDue(`${year + 1}-02-28`)).toBe(true);
    // right window, but the figures are already current → nothing to prompt
    expect(januaryFiguresDue(`${year}-01-10`)).toBe(false);
    // figures are behind, but this is not the window Israel publishes in
    expect(januaryFiguresDue(`${year + 1}-07-01`)).toBe(false);
  });
});
