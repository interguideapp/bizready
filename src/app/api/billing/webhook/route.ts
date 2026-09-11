import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  periodEndIso,
  stripeClient,
  subscriptionChangeFor,
  verifyWebhook,
  webhookConfigured,
} from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The ONLY writer of subscription state.
 *
 * Not the checkout redirect, not a success page, not a client callback. A
 * success URL is a URL the user controls, and treating arrival on it as proof
 * of payment is the same mistake as the self-serve free trial this replaces.
 * Migration 019 enforces that at the database level, so this route's service
 * role is the only thing that CAN write those columns.
 *
 * Every request is signature-verified and an unverifiable one is rejected. This
 * endpoint is public: without verification, anyone who learns the URL could POST
 * themselves a subscription.
 */
export async function POST(request: Request) {
  if (!webhookConfigured()) {
    // 503, not 200: a silent success would make Stripe stop retrying and the
    // payment would be lost with nobody noticing.
    console.error("stripe webhook received but billing is not configured");
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  // The raw body, byte for byte — parsing it first would break the signature.
  const rawBody = await request.text();
  const event = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  if (!event) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const change = subscriptionChangeFor(event);
  if (!change) {
    // A verified event we do not act on. 200 so Stripe stops retrying it.
    return NextResponse.json({ received: true, acted: false, type: event.type });
  }

  const supabase = createAdminClient();

  // Idempotency. Stripe retries, and it can deliver the same event more than
  // once; recording the id first means a duplicate is a no-op rather than a
  // second write.
  const { error: seenError } = await supabase
    .from("billing_events")
    .insert({ id: event.id, type: event.type });
  if (seenError) {
    // A unique violation means we have already handled this event.
    if (seenError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("billing_events insert failed", seenError.message);
    // 500 so Stripe retries: dropping it would lose the payment.
    return NextResponse.json({ error: "could not record event" }, { status: 500 });
  }

  // `until` is empty on checkout.session.completed, because the period end
  // lives on the subscription rather than the session. Fetch it instead of
  // guessing a window.
  let until = change.until;
  if (change.tier === "pro" && !until && change.subscriptionId) {
    const stripe = stripeClient();
    if (stripe) {
      try {
        const sub = await stripe.subscriptions.retrieve(change.subscriptionId);
        until = periodEndIso(sub as Stripe.Subscription);
      } catch (err) {
        console.error("could not read subscription period end", err);
      }
    }
  }

  const update: Record<string, unknown> = {
    subscription_tier: change.tier,
    billing_customer_id: change.customerId,
    billing_subscription_id: change.subscriptionId,
  };
  // Only ever write a period end we actually know. Writing null here would cut
  // a paying customer off the moment an unrelated event arrived.
  if (change.tier === "pro") {
    if (until) update.subscription_until = until;
    update.trial_used_at = new Date().toISOString();
  } else {
    update.subscription_until = null;
  }

  const { error } = await supabase
    .from("businesses")
    .update(update)
    .eq("id", change.businessId);

  if (error) {
    console.error("subscription update failed", change.businessId, error.message);
    // 500 so Stripe retries — the customer has paid and must get what they paid
    // for. The billing_events row is removed so the retry is not swallowed as a
    // duplicate.
    await supabase.from("billing_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    acted: true,
    businessId: change.businessId,
    tier: change.tier,
  });
}
