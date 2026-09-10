import { timingSafeEqual } from "node:crypto";

/**
 * Authorization for the cron routes.
 *
 * These routes run with the SERVICE ROLE (RLS bypass, every tenant), so they
 * must fail CLOSED. The previous guard was:
 *
 *   if (secret && auth !== `Bearer ${secret}`) return 401
 *
 * — with CRON_SECRET unset (its default, and it was never listed in
 * .env.local.example) the condition short-circuited, the check was skipped
 * entirely, and an anonymous GET ran the whole sweep across every business.
 *
 * No secret configured now means no access, and the comparison is timing-safe.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on length mismatch, so compare lengths first
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
