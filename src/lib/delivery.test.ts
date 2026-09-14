import { describe, expect, it } from "vitest";
import { deliveryFault, deliveryIsDown, type DeliveryHealth } from "@/lib/delivery";
import { anyOutboundChannel } from "@/lib/notify/configured";
import { allSweepHealth, needsAttention } from "@/lib/heartbeat";

/**
 * Telling the user that reminders are not going out.
 *
 * Every screen derives its own answer, so a dead scheduler cannot make a screen
 * wrong. What it makes wrong is the user's assumption: someone told the product
 * will email them before a deadline stops checking, and then nothing is
 * emailed. The screens stay honest and the silence lies.
 *
 * The heartbeat (029) has recorded exactly this since it shipped, and only
 * /admin read it — so the one person whose deadlines were at stake was the one
 * person not told.
 */
const NOW = "2026-09-13T09:00:00Z";

/** A configured mail provider, so these cases isolate the heartbeat half. */
const SENDABLE = { email: true, whatsapp: false, push: false };

/**
 * And a business that mail actually reaches, so they isolate it from the THIRD
 * way this promise breaks, discovered after these tests were written: a
 * configured provider that reaches nobody. Every case below that is about the
 * heartbeat has to hold the other two conditions true, or it would be passing
 * for a reason it does not name.
 */
const REACHED = { email: true, whatsapp: false, push: false };
const NO_REACH = { email: false, whatsapp: false, push: false };

const sweepOf = (lastOkAt: string | null, lastFailedAt: string | null = null) =>
  allSweepHealth([{ job: "reminders", lastOkAt, lastFailedAt }], NOW).find(
    (h) => h.job === "reminders"
  )!;

const health = (
  lastOkAt: string | null,
  lastFailedAt: string | null = null
): DeliveryHealth => ({
  sweep: sweepOf(lastOkAt, lastFailedAt),
  channels: SENDABLE,
  reach: REACHED,
});

describe("when to say it", () => {
  it("says it when the sweep has never run at all", () => {
    // The case that actually matters: an empty cron_runs table is a scheduler
    // that has not run once, and reporting that as healthy would be the worst
    // possible reading. allSweepHealth fills a missing job in as "never".
    const none = allSweepHealth([], NOW).find((h) => h.job === "reminders")!;
    expect(none.state).toBe("never");
    expect(deliveryIsDown({ sweep: none, channels: SENDABLE, reach: REACHED })).toBe(true);
  });

  it("says it when the last run was long enough ago to be an outage", () => {
    expect(deliveryIsDown(health("2026-09-01T02:00:00Z"))).toBe(true);
  });

  it("says it when the last run FAILED, even if it ran recently", () => {
    // A job that runs on schedule and errors every time is not healthy, and
    // "hours since last success" alone would have called it late at worst.
    const h = health("2026-08-20T02:00:00Z", "2026-09-13T02:00:00Z");
    expect(h.sweep!.failing).toBe(true);
    expect(deliveryIsDown(h)).toBe(true);
  });

  it("stays quiet for a single missed nightly run", () => {
    // A notice that fires on one skipped run gets ignored, and then the real
    // outage is invisible too. Same threshold the admin panel applies.
    //
    // 30 hours: past the 24-hour cadence, inside the 36-hour grace.
    const h = health("2026-09-12T03:00:00Z");
    expect(h.sweep!.state).toBe("late");
    expect(deliveryIsDown(h)).toBe(false);
  });

  it("stays quiet when the sweep ran last night", () => {
    expect(deliveryIsDown(health("2026-09-13T02:00:00Z"))).toBe(false);
  });

  it("stays quiet when the health read itself failed", () => {
    // A monitoring read must never break, or scare someone about, the page it
    // is monitoring. With no answer we say nothing.
    expect(deliveryIsDown(null)).toBe(false);
  });
});

describe("the user surfaces and the admin panel agree about what is broken", () => {
  it("raises the user notice for exactly the states the admin panel raises", () => {
    const cases: (string | null)[] = [
      null,
      "2026-09-13T02:00:00Z",
      "2026-09-12T03:00:00Z",
      "2026-09-01T02:00:00Z",
      "2026-06-01T02:00:00Z",
    ];
    for (const lastOk of cases) {
      const h = health(lastOk);
      // needsAttention is the admin threshold; the only deliberate difference
      // is a failing-but-recent job, which the user is told about because it
      // means their reminders are silently erroring.
      const admin = needsAttention([h.sweep!]).length > 0;
      expect(deliveryIsDown(h)).toBe(admin);
    }
  });
});

/**
 * THE HALF THAT WAS MISSING, and it was false in production.
 *
 * Measured against the live database on 2026-09-13: the lazy sweep ran at
 * 08:35, cron_runs had its first row, and it wrote thirteen in-app
 * notifications. reminder_log had ZERO rows — not failures, nothing — because
 * sendEmailDigest returns { ok: false, error: "email not configured" } before
 * it attempts anything, and no mail provider is set. Both businesses had
 * notify_email = true.
 *
 * With the sweep healthy, deliveryIsDown was false. So the obligations board
 * rendered "שומר הדדליינים פעיל — נזכיר לכם 30, 14, 7 ויום לפני כל דדליין" to
 * someone who would receive none of those four messages, the settings caveat
 * stayed hidden on the screen where a person ticks a box and stops checking,
 * and DeliveryNotice never appeared.
 *
 * A promise is not kept by a job that runs. It is kept by a message that
 * arrives.
 */
const NOTHING_CONFIGURED = { email: false, whatsapp: false, push: false };

describe("a healthy sweep with nowhere to send is still not delivery", () => {
  it("reports down when no channel is configured, however fresh the sweep", () => {
    expect(
      deliveryIsDown({
        sweep: sweepOf("2026-09-13T08:35:00Z"),
        channels: NOTHING_CONFIGURED,
        reach: NO_REACH,
      })
    ).toBe(true);
  });

  it("reports down even when the sweep ran seconds ago", () => {
    expect(
      deliveryIsDown({ sweep: sweepOf(NOW), channels: NOTHING_CONFIGURED, reach: NO_REACH })
    ).toBe(true);
  });

  it("counts push on its own, because it reaches a closed tab", () => {
    const pushOnly = { email: false, whatsapp: false, push: true };
    expect(anyOutboundChannel(pushOnly)).toBe(true);
    expect(deliveryIsDown({ sweep: sweepOf(NOW), channels: pushOnly, reach: pushOnly })).toBe(false);
  });

  it("counts WhatsApp on its own too", () => {
    const waOnly = { email: false, whatsapp: true, push: false };
    expect(deliveryIsDown({ sweep: sweepOf(NOW), channels: waOnly, reach: waOnly })).toBe(false);
  });
});

describe("the two faults are told apart, because the copy differs", () => {
  it("names an unconfigured service as unconfigured, not as an outage", () => {
    // "לא נשלחו מזה 3 ימים" implies it worked four days ago, and sends the
    // reader to check a setting that is not the cause.
    expect(
      deliveryFault({
        sweep: sweepOf("2026-09-13T08:35:00Z"),
        channels: NOTHING_CONFIGURED,
        reach: NO_REACH,
      })
    ).toBe("unconfigured");
  });

  it("names a real outage as a sweep problem", () => {
    expect(deliveryFault(health("2026-09-01T02:00:00Z"))).toBe("sweep");
  });

  it("reports no fault when a channel exists and the sweep is fresh", () => {
    expect(deliveryFault(health("2026-09-13T02:00:00Z"))).toBe("none");
  });

  it("prefers 'unconfigured' when both are true, since it is the root cause", () => {
    // Fixing a scheduler that has nowhere to send changes nothing.
    expect(
      deliveryFault({ sweep: sweepOf(null), channels: NOTHING_CONFIGURED, reach: NO_REACH })
    ).toBe("unconfigured");
  });

  it("says nothing at all when the health read itself failed", () => {
    expect(deliveryFault(null)).toBe("none");
  });
});
