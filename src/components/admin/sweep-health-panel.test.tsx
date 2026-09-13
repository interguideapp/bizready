// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { allSweepHealth } from "@/lib/heartbeat";
import { SweepHealthPanel } from "./sweep-health-panel";

/**
 * The operator's view of whether the scheduled work runs.
 *
 * This panel existed and still could not answer the question that mattered.
 * Production's heartbeat was empty for the project's whole life, and an empty
 * heartbeat fits two different faults — the schedule was never registered, or
 * it fired and was rejected for a missing secret. The panel offered advice
 * ("שווה לבדוק ש-CRON_SECRET מוגדר") rather than the answer it was holding.
 */
afterEach(cleanup);

const NOW = "2026-09-13T06:05:00Z";
const nothingRun = () => allSweepHealth([], NOW);
const allFresh = () =>
  allSweepHealth(
    [
      { job: "reminders", lastOkAt: "2026-09-13T06:00:00Z", lastFailedAt: null },
      { job: "sync", lastOkAt: "2026-09-13T06:00:00Z", lastFailedAt: null },
      { job: "retention", lastOkAt: "2026-09-08T06:00:00Z", lastFailedAt: null },
      { job: "source-watch", lastOkAt: "2026-09-07T06:00:00Z", lastFailedAt: null },
    ],
    NOW
  );

describe("the missing secret is named as the cause", () => {
  it("says it outright rather than suggesting it be checked", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} />);
    expect(screen.getByText(/CRON_SECRET לא מוגדר בסביבה הזו/)).toBeDefined();
  });

  it("says what to do about it", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} />);
    expect(screen.getByText(/Environment Variables/)).toBeDefined();
  });

  it("does not also raise the symptom as a second alarm", () => {
    // A missing secret IS why every job is stalled. Two red banners of equal
    // weight bury the one line that says what to do — seen by looking at it.
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} />);
    expect(screen.queryByText(/עבודות מתוזמנות קריטיות לא רצות/)).toBeNull();
  });

  it("still lists every job's own state, so nothing is hidden", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} />);
    expect(screen.getAllByText("לא רצה מעולם")).toHaveLength(4);
  });
});

describe("when the secret is set and things are still broken", () => {
  it("rules the secret out and points at the registration instead", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured />);
    expect(screen.getByText(/CRON_SECRET מוגדר, כך שדחייה על אימות אינה ההסבר/)).toBeDefined();
    // The Hobby limit that actually caused this, named where it is useful.
    expect(screen.getByText(/מותרות שתי/)).toBeDefined();
  });

  it("does raise the symptom here, because the cause is not yet known", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured />);
    expect(screen.getByText(/עבודות מתוזמנות קריטיות לא רצות/)).toBeDefined();
  });
});

describe("when everything is running", () => {
  it("says nothing alarming at all", () => {
    render(<SweepHealthPanel health={allFresh()} secretConfigured />);
    expect(screen.queryByText(/CRON_SECRET/)).toBeNull();
    expect(screen.queryByText(/לא רצות/)).toBeNull();
    expect(screen.queryByText(/לא רצה מעולם/)).toBeNull();
  });

  it("does not print each job's name twice", () => {
    // The row shows the label in bold and the summary repeated it, so it read
    // "תזכורות / תזכורות: רצה לפני 0 שעות".
    render(<SweepHealthPanel health={allFresh()} secretConfigured />);
    expect(screen.getAllByText(/^תזכורות$/)).toHaveLength(1);
  });
});
