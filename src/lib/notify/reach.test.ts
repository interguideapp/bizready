import { describe, expect, it } from "vitest";
import {
  anyOutboundChannel,
  anyReach,
  reachableChannels,
  type NotifyPrefs,
  type OutboundChannels,
} from "@/lib/notify/configured";
import { deliveryFault, deliveryIsDown, remindersWillReach } from "@/lib/delivery";
import { allSweepHealth } from "@/lib/heartbeat";

/**
 * A CONFIGURED PROVIDER IS NOT A DELIVERED MESSAGE, EITHER.
 *
 * Third time this same shape has been found in one pipeline, and the pattern is
 * identical every time: the check that gates the PROMISE is cheaper than the
 * check the SENDER performs, so it says yes where the sender says no, and it
 * does that silently and reassuringly.
 *
 *   1. "the sweep ran"        -> but no provider was configured
 *   2. "a provider exists"    -> but it reaches nobody      <- this file
 *
 * Measured on the live database (2026-09-14), both businesses:
 * notify_push = false, push_subscriptions = 0, no WhatsApp phone. So setting
 * the VAPID keys alone — the exact next step recommended on /admin — would
 * have made anyOutboundChannel true, deliveryIsDown false, and the obligations
 * board would have gone back to promising "נזכיר לכם 30, 14, 7 ויום לפני כל
 * חובה והגשה" to two businesses with no route to either of them.
 *
 * The reminders route has always been right. Only the promise was wrong.
 */
const NOW = "2026-09-14T09:00:00Z";
const freshSweep = allSweepHealth([{ job: "reminders", lastOkAt: NOW, lastFailedAt: null }], NOW).find(
  (h) => h.job === "reminders"
)!;

const ALL_CONFIGURED: OutboundChannels = { email: true, whatsapp: true, push: true };

/** What the live rows actually said. */
const LIVE_PREFS: NotifyPrefs = {
  notifyEmail: true,
  notifyPush: false,
  notifyWhatsapp: false,
  hasWhatsappPhone: false,
  pushDevices: 0,
};

describe("reachableChannels asks the three questions the sender asks", () => {
  it("drops a channel the business switched off", () => {
    const reach = reachableChannels(ALL_CONFIGURED, { ...LIVE_PREFS, notifyEmail: false });
    expect(reach.email).toBe(false);
  });

  it("keeps a channel that is configured AND on", () => {
    expect(reachableChannels(ALL_CONFIGURED, LIVE_PREFS).email).toBe(true);
  });

  it("drops push when no browser has subscribed, however good the keys are", () => {
    // The whole point. Push is the only channel that needs the USER to have
    // done something before it can reach them, and env vars cannot see it.
    const reach = reachableChannels(ALL_CONFIGURED, {
      ...LIVE_PREFS,
      notifyPush: true,
      pushDevices: 0,
    });
    expect(reach.push).toBe(false);
  });

  it("keeps push once a device is subscribed", () => {
    const reach = reachableChannels(ALL_CONFIGURED, {
      ...LIVE_PREFS,
      notifyPush: true,
      pushDevices: 1,
    });
    expect(reach.push).toBe(true);
  });

  it("drops WhatsApp with no phone number, because there is nowhere to send", () => {
    const reach = reachableChannels(ALL_CONFIGURED, {
      ...LIVE_PREFS,
      notifyWhatsapp: true,
      hasWhatsappPhone: false,
    });
    expect(reach.whatsapp).toBe(false);
  });

  it("never invents a channel the deployment does not have", () => {
    const reach = reachableChannels(
      { email: false, whatsapp: false, push: false },
      { notifyEmail: true, notifyPush: true, notifyWhatsapp: true, hasWhatsappPhone: true, pushDevices: 9 }
    );
    expect(anyReach(reach)).toBe(false);
  });
});

describe("the live state, which is the regression this exists to stop", () => {
  /** VAPID keys set and nothing else — the state one env-var paste away. */
  const PUSH_ONLY: OutboundChannels = { email: false, whatsapp: false, push: true };

  it("counted as a working channel under the old check", () => {
    // Kept as a live demonstration, not nostalgia: this is what the surfaces
    // were reading, and it is still true of the configured-only question.
    expect(anyOutboundChannel(PUSH_ONLY)).toBe(true);
  });

  it("reaches nobody once the business's own rows are consulted", () => {
    expect(anyReach(reachableChannels(PUSH_ONLY, LIVE_PREFS))).toBe(false);
  });

  it("so the board may not claim the guard is active", () => {
    const health = {
      sweep: freshSweep,
      channels: PUSH_ONLY,
      reach: reachableChannels(PUSH_ONLY, LIVE_PREFS),
    };
    expect(remindersWillReach(health)).toBe(false);
  });

  it("but is reported as the user's own setting, not as an outage", () => {
    // "reminders are not going out" would send them hunting a fault that does
    // not exist; the honest answer names the switch.
    const health = {
      sweep: freshSweep,
      channels: PUSH_ONLY,
      reach: reachableChannels(PUSH_ONLY, LIVE_PREFS),
    };
    expect(deliveryFault(health)).toBe("opted-out");
    expect(deliveryIsDown(health)).toBe(false);
  });
});

describe("an unreadable answer claims nothing in either direction", () => {
  /*
   * The failure mode of the fix. If the prefs read errors, "reachable" puts
   * the false promise straight back, and "unreachable" tells someone their
   * reminders are off when they are not. Neither guess is acceptable, so the
   * state is named.
   */
  const unknown = { sweep: freshSweep, channels: ALL_CONFIGURED, reach: null };

  it("makes no promise", () => {
    expect(remindersWillReach(unknown)).toBe(false);
  });

  it("and raises no alarm", () => {
    expect(deliveryIsDown(unknown)).toBe(false);
    expect(deliveryFault(unknown)).toBe("unknown");
  });
});

describe("a business that IS reachable still gets the promise", () => {
  it("says delivery will reach when provider, switch and sweep all agree", () => {
    // The fix must not be a blanket silencer: the whole point of setting a
    // provider up is that this banner becomes true.
    const channels: OutboundChannels = { email: true, whatsapp: false, push: false };
    const health = {
      sweep: freshSweep,
      channels,
      reach: reachableChannels(channels, LIVE_PREFS),
    };
    expect(remindersWillReach(health)).toBe(true);
    expect(deliveryFault(health)).toBe("none");
  });
});
