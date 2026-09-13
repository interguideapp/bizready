import { describe, expect, it } from "vitest";
import { ENDING_SOON_DAYS, isPro, subscriptionStanding } from "@/lib/subscription";

/**
 * The one billing period the product never tracked: its own.
 *
 * `subscription_until` is the end of the current billing period, and isPro goes
 * false the moment it passes. For a monthly subscriber that is roughly thirty
 * days out, and it only moves when Stripe's renewal event arrives — which in
 * this project demonstrably failed for months, because proxy.ts redirected
 * every machine-called endpoint to /login. The user-visible result was Pro
 * ending, the escalating reminder windows narrowing to the free set, and no
 * screen saying why.
 */
const NOW = new Date("2026-09-13T09:00:00Z");
const pro = (until: string | null) => ({
  subscription_tier: "pro",
  subscription_until: until,
});

describe("the billing period has four states, not two", () => {
  it("is active with the period comfortably ahead", () => {
    expect(subscriptionStanding(pro("2026-12-01T00:00:00Z"), NOW)).toMatchObject({
      state: "active",
    });
  });

  it("is ending_soon inside the warning window", () => {
    const s = subscriptionStanding(pro("2026-09-16T09:00:00Z"), NOW);
    expect(s.state).toBe("ending_soon");
    expect(s.daysLeft).toBe(3);
  });

  it("is lapsed once it has passed, and says how long ago", () => {
    const s = subscriptionStanding(pro("2026-09-01T09:00:00Z"), NOW);
    expect(s.state).toBe("lapsed");
    expect(s.daysLeft).toBe(-12);
  });

  it("separates lapsed from never having subscribed", () => {
    // The tier column still reads pro while the date has passed. That is the
    // only thing distinguishing a failed payment from a new user, and it is
    // what lets the product say "your subscription ended" instead of selling.
    expect(subscriptionStanding(pro("2026-09-01T09:00:00Z"), NOW).state).toBe("lapsed");
    expect(
      subscriptionStanding({ subscription_tier: "free", subscription_until: null }, NOW).state
    ).toBe("none");
  });

  it("treats an open-ended pro row as active", () => {
    expect(subscriptionStanding(pro(null), NOW).state).toBe("active");
  });

  it("puts the boundary exactly at the declared window", () => {
    const inside = new Date(NOW.getTime() + ENDING_SOON_DAYS * 86_400_000);
    const outside = new Date(NOW.getTime() + (ENDING_SOON_DAYS + 1) * 86_400_000);
    expect(subscriptionStanding(pro(inside.toISOString()), NOW).state).toBe("ending_soon");
    expect(subscriptionStanding(pro(outside.toISOString()), NOW).state).toBe("active");
  });
});

describe("the gate and the banner cannot disagree", () => {
  it("grants access in both states that are still paid", () => {
    expect(isPro(pro("2026-12-01T00:00:00Z"), NOW)).toBe(true);
    expect(isPro(pro("2026-09-16T09:00:00Z"), NOW)).toBe(true);
  });

  it("withholds it once lapsed, and for a free row", () => {
    expect(isPro(pro("2026-09-01T09:00:00Z"), NOW)).toBe(false);
    expect(isPro({ subscription_tier: "free", subscription_until: null }, NOW)).toBe(false);
  });

  it("does not revoke a paying customer over an unreadable date", () => {
    /**
     * isPro used to compare dates itself, and `new Date("nonsense") > new Date()`
     * is false — so a bad value revoked Pro while any banner reading the same
     * row called it active. periodEndIso already decided this direction: an
     * unreadable period end must not shorten the window. Only the Stripe
     * webhook can write these columns (migration 019 blocks every session), so
     * this cannot be used to grant Pro to anyone.
     */
    expect(subscriptionStanding(pro("not-a-date"), NOW).state).toBe("active");
    expect(isPro(pro("not-a-date"), NOW)).toBe(true);
  });

  it("agrees with the standing for every state", () => {
    const cases: Array<[string | null, boolean]> = [
      ["2026-12-01T00:00:00Z", true],
      ["2026-09-16T09:00:00Z", true],
      ["2026-09-01T09:00:00Z", false],
      [null, true],
    ];
    for (const [until, expected] of cases) {
      const { state } = subscriptionStanding(pro(until), NOW);
      expect(isPro(pro(until), NOW)).toBe(expected);
      expect(state === "active" || state === "ending_soon").toBe(expected);
    }
  });
});
