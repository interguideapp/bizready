// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeliveryNotice } from "./delivery-notice";
import type { DeliveryHealth } from "@/lib/delivery";
import { allSweepHealth } from "@/lib/heartbeat";

/**
 * What the notice says, for each of the two ways delivery can be false.
 *
 * It only ever knew one: the sweep being stale or failing. The production state
 * on 2026-09-13 was the other one — a sweep that had just run successfully and
 * no mail provider configured, so reminder_log was empty and this notice never
 * rendered at all.
 *
 * The wording matters as much as the appearing. Telling someone "לא נשלחו
 * התראות מזה 3 ימים" when no channel has ever existed implies it worked four
 * days ago and sends them to check a setting that is not the cause.
 */
afterEach(cleanup);

const NOW = "2026-09-13T09:00:00Z";
const sweepOf = (lastOkAt: string | null) =>
  allSweepHealth([{ job: "reminders", lastOkAt, lastFailedAt: null }], NOW).find(
    (h) => h.job === "reminders"
  )!;

const unconfigured: DeliveryHealth = {
  // Ran eight minutes ago and succeeded — exactly the live state.
  sweep: sweepOf("2026-09-13T08:52:00Z"),
  channels: { email: false, whatsapp: false, push: false },
};

const outage: DeliveryHealth = {
  sweep: sweepOf("2026-09-01T02:00:00Z"),
  channels: { email: true, whatsapp: false, push: false },
};

describe("no channel configured", () => {
  it("says the service is not set up, not that sending stopped", () => {
    render(<DeliveryNotice health={unconfigured} />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/לא מוגדרות/);
    // Must not imply it used to work and counted days since.
    expect(text).not.toMatch(/מזה \d+ ימים/);
  });

  it("does not tell the reader to wait for sending to come back", () => {
    render(<DeliveryNotice health={unconfigured} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/עד שהשליחה תחזור/);
    expect(text).toMatch(/אין על מה לחכות/);
  });

  it("still says what IS true, so it does not read as 'trust nothing'", () => {
    render(<DeliveryNotice health={unconfigured} />);
    expect(document.body.textContent ?? "").toMatch(/מחושב מחדש/);
  });
});

describe("a genuine outage", () => {
  it("counts the days, because it did work before", () => {
    render(<DeliveryNotice health={outage} />);
    expect(document.body.textContent ?? "").toMatch(/מזה \d+ ימים/);
  });

  it("tells the reader it is expected back", () => {
    render(<DeliveryNotice health={outage} />);
    expect(document.body.textContent ?? "").toMatch(/עד שהשליחה תחזור/);
  });
});

describe("the compact form still names the state", () => {
  it("carries the unconfigured wording too", () => {
    render(<DeliveryNotice health={unconfigured} compact />);
    expect(document.body.textContent ?? "").toMatch(/לא מוגדרות/);
  });

  it("links onward to the full list", () => {
    render(<DeliveryNotice health={unconfigured} compact />);
    expect(screen.getByRole("link", { name: /לכל ההתראות/ })).toBeDefined();
  });
});
