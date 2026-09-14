import { emailConfigured, whatsappConfigured } from "@/lib/notify/channels";
import { pushConfigured } from "@/lib/notify/push";

/**
 * Can anything actually leave the building?
 *
 * The heartbeat answers "did the sweep run". That turned out to be only half of
 * "are reminders reaching the user", and the half that was missing is the one
 * that was false in production: the sweep ran, wrote thirteen in-app
 * notifications, and sent zero messages, because no mail provider is
 * configured. reminder_log had no rows at all — not failures, nothing, because
 * sendEmailDigest returns { ok: false, error: "email not configured" } before
 * it tries.
 *
 * With the sweep healthy, deliveryIsDown was false, so the obligations board
 * showed "שומר הדדליינים פעיל — נזכיר לכם 30, 14, 7 ויום לפני כל דדליין" to
 * someone who was going to receive none of those four messages. A promise is
 * not kept by a job that runs; it is kept by a message that arrives.
 *
 * Env-var presence only. No key, no value, nothing secret crosses this
 * boundary — the callers turn it into booleans for the client.
 */
export interface OutboundChannels {
  email: boolean;
  whatsapp: boolean;
  push: boolean;
}

export function outboundChannels(): OutboundChannels {
  return {
    email: emailConfigured(),
    whatsapp: whatsappConfigured(),
    push: pushConfigured(),
  };
}

/**
 * Is there at least one way to reach someone who is not looking at the app?
 *
 * Push counts: it reaches a closed tab. In-app notifications deliberately do
 * NOT count — they are derived on every page load and cannot fail, which is
 * why they are never what a delivery warning is about.
 */
export function anyOutboundChannel(channels: OutboundChannels): boolean {
  return channels.email || channels.whatsapp || channels.push;
}

/**
 * What the SENDER checks, for one business — which is not what the env vars say.
 *
 * outboundChannels above answers "does this deployment have a provider". That
 * is a necessary condition and it is not sufficient, and the gap between the
 * two is where a promise goes to die. The reminders route does not send on
 * `emailConfigured()`; it sends on `biz.notify_email && emailConfigured()`, on
 * `biz.notify_push && pushConfigured()` AND a row in push_subscriptions, and
 * on `biz.notify_whatsapp && biz.whatsapp_phone && whatsappConfigured()`.
 *
 * Measured on the live database at the time of writing: both businesses had
 * notify_push false and ZERO push subscriptions. So setting the VAPID keys —
 * and nothing else, which is the exact next step /admin recommends — would
 * have made anyOutboundChannel true, deliveryIsDown false, and the obligations
 * board would have promised "נזכיר לכם 30, 14, 7 ויום לפני כל חובה" to two
 * businesses that cannot receive a single message. The keys are real, the
 * provider is real, and there is no device to send to.
 *
 * Push is the channel where this bites hardest, because it is the only one
 * that needs the user to have done something (subscribe a browser) before it
 * can reach them at all. An env-var check cannot see that.
 */
export interface NotifyPrefs {
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  /** A channel with no address is not a channel. */
  hasWhatsappPhone: boolean;
  /** Browsers subscribed to push for this business. Zero reaches nobody. */
  pushDevices: number;
}

/** Channels that can actually deliver to this business right now. */
export type ChannelReach = OutboundChannels;

export function reachableChannels(
  channels: OutboundChannels,
  prefs: NotifyPrefs
): ChannelReach {
  return {
    // The address comes from the authenticated account, which always has one,
    // so enabled + configured is the whole condition. The sender still
    // releases its claim if the lookup comes back empty.
    email: channels.email && prefs.notifyEmail,
    push: channels.push && prefs.notifyPush && prefs.pushDevices > 0,
    whatsapp: channels.whatsapp && prefs.notifyWhatsapp && prefs.hasWhatsappPhone,
  };
}

/**
 * Is there a path to this business, as opposed to a path in principle?
 *
 * Deliberately NOT a second copy of anyOutboundChannel's body: they answer
 * different questions and must be able to disagree, because the case that
 * matters is exactly the one where they do.
 */
export function anyReach(reach: ChannelReach | null): boolean {
  if (!reach) return false;
  return reach.email || reach.push || reach.whatsapp;
}
