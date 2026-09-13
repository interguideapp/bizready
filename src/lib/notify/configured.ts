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
