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

/** A configured provider, so the existing cases isolate the heartbeat half. */
const SENDABLE = { email: true, whatsapp: false, push: false };

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
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.getByText(/CRON_SECRET לא מוגדר בסביבה הזו/)).toBeDefined();
  });

  it("says what to do about it", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.getByText(/Environment Variables/)).toBeDefined();
  });

  it("does not also raise the symptom as a second alarm", () => {
    // A missing secret IS why every job is stalled. Two red banners of equal
    // weight bury the one line that says what to do — seen by looking at it.
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.queryByText(/עבודות מתוזמנות קריטיות לא רצות/)).toBeNull();
  });

  it("still lists every job's own state, so nothing is hidden", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.getAllByText("לא רצה מעולם")).toHaveLength(4);
  });
});

describe("when the secret is set and things are still broken", () => {
  it("rules the secret out and points at the registration instead", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured channels={SENDABLE} pushDevices={0} />);
    expect(screen.getByText(/CRON_SECRET מוגדר, כך שדחייה על אימות אינה ההסבר/)).toBeDefined();
    // The Hobby limit that actually caused this, named where it is useful.
    expect(screen.getByText(/מותרות שתי/)).toBeDefined();
  });

  it("does raise the symptom here, because the cause is not yet known", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured channels={SENDABLE} pushDevices={0} />);
    expect(screen.getByText(/עבודות מתוזמנות קריטיות לא רצות/)).toBeDefined();
  });
});

describe("when everything is running", () => {
  it("says nothing alarming at all", () => {
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={SENDABLE} pushDevices={0} />);
    expect(screen.queryByText(/CRON_SECRET/)).toBeNull();
    expect(screen.queryByText(/לא רצות/)).toBeNull();
    expect(screen.queryByText(/לא רצה מעולם/)).toBeNull();
  });

  it("does not print each job's name twice", () => {
    // The row shows the label in bold and the summary repeated it, so it read
    // "תזכורות / תזכורות: רצה לפני 0 שעות".
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={SENDABLE} pushDevices={0} />);
    expect(screen.getAllByText(/^תזכורות$/)).toHaveLength(1);
  });
});

describe("a job can be run by hand", () => {
  it("offers a run control for every job", () => {
    // With CRON_SECRET unset every /api/cron/* call is rejected — correctly —
    // which left NO way to run the sweep at all, not even for the owner. The
    // dispatcher's own comment claimed the individual routes were "how a single
    // job is re-run by hand"; they were not, because the hand has no secret.
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.getAllByRole("button", { name: /הרצה עכשיו/ })).toHaveLength(4);
  });

  it("names which job each control runs, for a screen reader", () => {
    render(<SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={SENDABLE} pushDevices={0} />);
    expect(screen.getByRole("button", { name: "הרצה עכשיו: תזכורות" })).toBeDefined();
  });

  it("offers it even when everything is healthy", () => {
    // A manual re-run is how an operator retries one failed job, not only how
    // they work around a dead schedule.
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={SENDABLE} pushDevices={0} />);
    expect(screen.getAllByRole("button", { name: /הרצה עכשיו/ })).toHaveLength(4);
  });
});

/**
 * The SECOND thing delivery needs, which this panel did not report.
 *
 * Live state on 2026-09-13: the sweep ran and succeeded, cron_runs had a row,
 * thirteen in-app notifications were written, and reminder_log was completely
 * empty — because no provider is configured and sendEmailDigest returns
 * "email not configured" before it attempts anything. Empty rather than full of
 * failures is the hardest shape to notice.
 *
 * An operator reading the old panel would set CRON_SECRET, watch the runs below
 * start accumulating, conclude it was fixed, and still send nothing.
 */
const NO_CHANNEL = { email: false, whatsapp: false, push: false };

describe("no outbound channel is reported as its own cause", () => {
  it("says it even when every job is healthy", () => {
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={NO_CHANNEL} pushDevices={0} />);
    expect(screen.getByText(/אין ערוץ שליחה מוגדר/)).toBeDefined();
  });

  it("names the exact variables, so the fix is one step", () => {
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={NO_CHANNEL} pushDevices={0} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("RESEND_API_KEY");
    expect(text).toContain("REMINDER_FROM_EMAIL");
  });

  it("explains why the log is empty rather than failing", () => {
    // The detail that makes this findable next time: absence of rows is not
    // absence of a problem.
    render(<SweepHealthPanel health={allFresh()} secretConfigured channels={NO_CHANNEL} pushDevices={0} />);
    expect(document.body.textContent ?? "").toMatch(/נשאר ריק/);
  });

  it("stays quiet, and says what is configured, once a channel exists", () => {
    render(
      <SweepHealthPanel
        health={allFresh()}
        secretConfigured
        channels={{ email: true, whatsapp: false, push: true }}
        pushDevices={2}
      />
    );
    expect(screen.queryByText(/אין ערוץ שליחה מוגדר/)).toBeNull();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/ערוצים מוגדרים/);
    expect(text).toMatch(/מייל/);
    expect(text).toMatch(/פוש/);
  });

  it("reports both gaps at once when both are open", () => {
    // They are independent requirements, so fixing one and being told nothing
    // about the other is the trap this closes.
    render(
      <SweepHealthPanel health={nothingRun()} secretConfigured={false} channels={NO_CHANNEL} pushDevices={0} />
    );
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/CRON_SECRET לא מוגדר/);
    expect(text).toMatch(/אין ערוץ שליחה מוגדר/);
  });
});

/**
 * CONFIGURED IS NOT REACHABLE.
 *
 * The panel's job is to stop an operator believing delivery works. It learned
 * to say "no provider" after reminder_log was found empty; this is the next
 * layer of the same mistake, and it was one env-var paste from being live.
 * Measured on the database: keys would have been set, notify_push was false on
 * every business, push_subscriptions had zero rows.
 */
describe("push with keys but no subscribed device", () => {
  const PUSH_ON = { email: false, whatsapp: false, push: true };

  it("says the channel has no destination", () => {
    render(
      <SweepHealthPanel health={allFresh()} secretConfigured channels={PUSH_ON} pushDevices={0} />
    );
    expect(screen.getByText(/הפוש מוגדר אבל אין לו יעד/)).toBeDefined();
  });

  it("names the variable whose absence hides the subscribe button", () => {
    // Four variables for one channel and the panel used to name two. An
    // operator who set the trio and not the public copy would see a configured
    // channel, no subscribers, and no explanation anywhere.
    render(
      <SweepHealthPanel health={allFresh()} secretConfigured channels={PUSH_ON} pushDevices={0} />
    );
    expect(document.body.textContent ?? "").toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  });

  it("names VAPID_SUBJECT, which the sender requires and the panel omitted", () => {
    render(
      <SweepHealthPanel
        health={allFresh()}
        secretConfigured
        channels={{ email: false, whatsapp: false, push: false }}
        pushDevices={0}
      />
    );
    expect(document.body.textContent ?? "").toMatch(/VAPID_SUBJECT/);
  });

  it("goes quiet once a device is subscribed", () => {
    render(
      <SweepHealthPanel health={allFresh()} secretConfigured channels={PUSH_ON} pushDevices={3} />
    );
    expect(screen.queryByText(/אין לו יעד/)).toBeNull();
    expect(document.body.textContent ?? "").toMatch(/דפדפנים רשומים לפוש/);
  });

  it("does not claim a missing destination when push is not configured at all", () => {
    // That is a different sentence, already written, and two alarms about one
    // channel is how a panel gets ignored.
    render(
      <SweepHealthPanel
        health={allFresh()}
        secretConfigured
        channels={{ email: true, whatsapp: false, push: false }}
        pushDevices={0}
      />
    );
    expect(screen.queryByText(/אין לו יעד/)).toBeNull();
  });
});
