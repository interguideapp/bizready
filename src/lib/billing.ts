import Stripe from "stripe";

/**
 * Billing. One writer of subscription state, and it is this file's webhook.
 *
 * What this replaces: `startProTrial` set `subscription_tier = "pro"` with no
 * payment, no record that a trial had been used, and was re-callable
 * indefinitely — so it granted rolling free Pro windows for ever. Its own
 * docstring said "Never ship self-serve free Pro to production". It was wired
 * to a plain button.
 *
 * The design has three rules, and they exist because each one was broken before:
 *
 * 1. **Only the webhook writes.** Not the checkout redirect, not a success
 *    page, not a client callback. A success redirect is a URL the user controls;
 *    treating arrival on it as proof of payment is the same class of mistake as
 *    the old self-serve trial. Migration 019 enforces this at the database level
 *    with a trigger, so it is not merely a convention.
 *
 * 2. **Every webhook is signature-verified**, and an unverifiable one is
 *    rejected rather than processed optimistically. The webhook endpoint is
 *    public; without verification anyone who learns the URL can grant
 *    themselves Pro, which is exactly the hole the inbound integration webhooks
 *    had before HMAC was made mandatory.
 *
 * 3. **It is inert without configuration.** No keys, no checkout — and the user
 *    is told so plainly instead of being sent into a broken flow.
 */

/** Set when both the secret key and a price are configured. */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function webhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

let client: Stripe | null = null;

/**
 * The Stripe client, or null when unconfigured.
 *
 * Returns null rather than throwing so callers can degrade to "not available
 * yet" instead of producing a 500 on a page the user merely visited.
 */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

export interface CheckoutRequest {
  businessId: string;
  userId: string;
  email: string | null;
  /** Absolute origin, for the return URLs. */
  origin: string;
  existingCustomerId: string | null;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; reason: "unconfigured" | "failed" };

/**
 * Creates a Checkout Session and returns its hosted URL.
 *
 * `client_reference_id` carries the business id, and the metadata repeats it.
 * That is what lets the webhook identify WHICH business paid without trusting
 * anything the browser sends back — the webhook never reads a query parameter.
 */
export async function createCheckoutSession(
  req: CheckoutRequest
): Promise<CheckoutResult> {
  const stripe = stripeClient();
  const price = process.env.STRIPE_PRICE_ID;
  if (!stripe || !price) {
    return {
      ok: false,
      reason: "unconfigured",
      error: "השדרוג ל-Pro עוד לא פתוח. נעדכן אותך ברגע שייפתח.",
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Identifies the payer to the webhook. Never read back from the redirect.
      client_reference_id: req.businessId,
      metadata: { business_id: req.businessId, user_id: req.userId },
      subscription_data: {
        metadata: { business_id: req.businessId, user_id: req.userId },
      },
      ...(req.existingCustomerId
        ? { customer: req.existingCustomerId }
        : req.email
          ? { customer_email: req.email }
          : {}),
      // The success page confirms nothing on its own — it waits for the
      // webhook to have landed, and says so if it has not.
      success_url: `${req.origin}/settings?upgrade=processing`,
      cancel_url: `${req.origin}/settings?upgrade=cancelled`,
      allow_promotion_codes: true,
      locale: "he",
    });

    if (!session.url) {
      return { ok: false, reason: "failed", error: "לא הצלחנו לפתוח את דף התשלום." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createCheckoutSession failed", err);
    return { ok: false, reason: "failed", error: "לא הצלחנו לפתוח את דף התשלום. נסו שוב." };
  }
}

/**
 * Verifies a webhook signature and returns the event, or null.
 *
 * Uses Stripe's own `constructEvent`, which does the timing-safe comparison and
 * the timestamp-tolerance check. Rolling our own here would be a mistake: a
 * replayed old event is as dangerous as a forged one.
 */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) return null;
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("stripe webhook signature rejected", err);
    return null;
  }
}

/** What a verified event means for a business's subscription row. */
export interface SubscriptionChange {
  businessId: string;
  tier: "free" | "pro";
  /** ISO timestamp the access runs until, or null for free. */
  until: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

/**
 * Translates a verified Stripe event into a subscription change, or null when
 * the event is not one we act on.
 *
 * Kept pure and exported so it can be tested without a Stripe account — the
 * mapping from event to state is the part most likely to be subtly wrong, and
 * it is the part that decides whether someone is charged and gets nothing.
 */
export function subscriptionChangeFor(event: Stripe.Event): SubscriptionChange | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId =
        session.client_reference_id ?? session.metadata?.business_id ?? null;
      if (!businessId) return null;
      // `paid` is the only status that grants access. `unpaid`/`no_payment_required`
      // must not: a session can complete without money moving.
      if (session.payment_status !== "paid") return null;
      return {
        businessId,
        tier: "pro",
        until: null, // filled from the subscription's period end below
        customerId: typeof session.customer === "string" ? session.customer : null,
        subscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
      };
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.business_id ?? null;
      if (!businessId) return null;
      // active and trialing grant access; past_due, unpaid, incomplete and
      // canceled do not. Treating past_due as active would give away the
      // product to a card that stopped working.
      const granting = sub.status === "active" || sub.status === "trialing";
      return {
        businessId,
        tier: granting ? "pro" : "free",
        until: granting ? periodEndIso(sub) : null,
        customerId: typeof sub.customer === "string" ? sub.customer : null,
        subscriptionId: sub.id,
      };
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.business_id ?? null;
      if (!businessId) return null;
      return {
        businessId,
        tier: "free",
        until: null,
        customerId: typeof sub.customer === "string" ? sub.customer : null,
        subscriptionId: sub.id,
      };
    }

    default:
      return null;
  }
}

/**
 * The end of the paid period, as an ISO timestamp.
 *
 * Read off the subscription item rather than the subscription: Stripe moved
 * `current_period_end` onto the items, and reading a missing field would yield
 * `undefined` -> an access window of "now", cancelling a paying customer
 * instantly. So an unreadable period end returns null and the caller keeps the
 * existing window rather than shortening it.
 */
export function periodEndIso(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const seconds =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
