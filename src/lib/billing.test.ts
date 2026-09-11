import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { periodEndIso, subscriptionChangeFor, verifyWebhook } from "./billing";

/**
 * The event -> state mapping is the part of billing most likely to be subtly
 * wrong, and it is the part that decides whether a customer is charged and gets
 * nothing, or stops paying and keeps the product. So it is pure and tested,
 * without needing a Stripe account.
 */

const BUSINESS = "biz-42";

function event<T>(type: string, object: T): Stripe.Event {
  return {
    id: "evt_test",
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

function subscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { business_id: BUSINESS },
    items: { data: [{ current_period_end: 1793000000 }] },
    ...over,
  };
}

describe("checkout.session.completed", () => {
  it("grants Pro when the session is actually paid", () => {
    const change = subscriptionChangeFor(
      event("checkout.session.completed", {
        client_reference_id: BUSINESS,
        payment_status: "paid",
        customer: "cus_1",
        subscription: "sub_1",
      })
    );
    expect(change).toMatchObject({
      businessId: BUSINESS,
      tier: "pro",
      customerId: "cus_1",
      subscriptionId: "sub_1",
    });
  });

  it("grants nothing when the session completed WITHOUT payment", () => {
    // A checkout session can reach "complete" with payment_status unpaid or
    // no_payment_required. Treating completion as payment is how you give the
    // product away.
    for (const payment_status of ["unpaid", "no_payment_required"]) {
      const change = subscriptionChangeFor(
        event("checkout.session.completed", {
          client_reference_id: BUSINESS,
          payment_status,
          subscription: "sub_1",
        })
      );
      expect(change, payment_status).toBeNull();
    }
  });

  it("ignores a session with no business attached", () => {
    // Without client_reference_id or metadata we do not know WHOSE
    // subscription this is, and guessing would upgrade the wrong account.
    const change = subscriptionChangeFor(
      event("checkout.session.completed", { payment_status: "paid", metadata: {} })
    );
    expect(change).toBeNull();
  });

  it("falls back to metadata when client_reference_id is absent", () => {
    const change = subscriptionChangeFor(
      event("checkout.session.completed", {
        payment_status: "paid",
        metadata: { business_id: BUSINESS },
      })
    );
    expect(change?.businessId).toBe(BUSINESS);
  });
});

describe("subscription lifecycle", () => {
  it("active and trialing grant access", () => {
    for (const status of ["active", "trialing"]) {
      const change = subscriptionChangeFor(
        event("customer.subscription.updated", subscription({ status }))
      );
      expect(change?.tier, status).toBe("pro");
      expect(change?.until, status).toBeTruthy();
    }
  });

  it("a card that stopped working does NOT keep the product", () => {
    // past_due is the one people get wrong: it looks active-ish, and treating
    // it as active means the product keeps being delivered to a subscription
    // that is no longer being paid.
    for (const status of ["past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused"]) {
      const change = subscriptionChangeFor(
        event("customer.subscription.updated", subscription({ status }))
      );
      expect(change?.tier, status).toBe("free");
      expect(change?.until, status).toBeNull();
    }
  });

  it("deletion revokes access", () => {
    const change = subscriptionChangeFor(
      event("customer.subscription.deleted", subscription({ status: "canceled" }))
    );
    expect(change).toMatchObject({ businessId: BUSINESS, tier: "free", until: null });
  });

  it("ignores a subscription with no business in its metadata", () => {
    const change = subscriptionChangeFor(
      event("customer.subscription.updated", subscription({ metadata: {} }))
    );
    expect(change).toBeNull();
  });

  it("ignores event types we do not act on", () => {
    for (const type of ["invoice.paid", "payment_intent.succeeded", "customer.created"]) {
      expect(subscriptionChangeFor(event(type, {})), type).toBeNull();
    }
  });
});

describe("periodEndIso", () => {
  it("reads the period end off the subscription ITEM", () => {
    // Stripe moved current_period_end onto the items. Reading the old location
    // yields undefined, which would become an access window of "now" and cut
    // off a paying customer instantly.
    const iso = periodEndIso(subscription() as unknown as Stripe.Subscription);
    expect(iso).toBe(new Date(1793000000 * 1000).toISOString());
  });

  it("still reads the legacy top-level field if that is where it is", () => {
    const sub = {
      ...subscription({ items: { data: [{}] } }),
      current_period_end: 1793000000,
    };
    expect(periodEndIso(sub as unknown as Stripe.Subscription)).toBe(
      new Date(1793000000 * 1000).toISOString()
    );
  });

  it("returns null rather than a bogus date when the period end is unreadable", () => {
    // null makes the caller KEEP the existing window. Returning something
    // wrong here would shorten a paid subscription.
    for (const items of [{ data: [{}] }, { data: [] }, undefined]) {
      const sub = subscription({ items }) as unknown as Stripe.Subscription;
      expect(periodEndIso(sub)).toBeNull();
    }
  });
});

describe("verifyWebhook", () => {
  it("rejects everything when the signing secret is not configured", () => {
    // Failing closed matters here: this endpoint is public, and accepting
    // unverified events would let anyone who finds the URL grant themselves a
    // subscription.
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(verifyWebhook("{}", "t=1,v1=abc")).toBeNull();
    if (previous !== undefined) process.env.STRIPE_WEBHOOK_SECRET = previous;
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhook("{}", null)).toBeNull();
  });
});
