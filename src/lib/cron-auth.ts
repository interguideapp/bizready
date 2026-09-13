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

  if (!secret) {
    // WHY THIS IS LOGGED.
    //
    // Failing closed is right, but it was indistinguishable from never being
    // called. Production's `cron_runs` table was empty, which is consistent
    // with two completely different faults: the schedule was never registered
    // (it wasn't — four cron entries on a Hobby plan that allows two), or it
    // fired and was rejected here. Both had to be guessed at.
    //
    // Nothing is written to the database: this endpoint is reachable
    // unauthenticated, so a DB write would be a spam vector. A log line costs
    // nothing and is readable from the Vercel runtime logs.
    console.warn(
      "[cron-auth] rejected: CRON_SECRET is not set in this environment." +
        ` ua=${request.headers.get("user-agent") ?? "none"}` +
        ` hasAuthHeader=${request.headers.get("authorization") !== null}`
    );
    return false;
  }

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on length mismatch, so compare lengths first
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    // Configured but wrong. Distinguishing this from the case above is the
    // whole point: it means the variable exists and does not match what Vercel
    // Cron is sending, which is a different fix.
    console.warn(
      "[cron-auth] rejected: CRON_SECRET is set but the request did not match." +
        ` ua=${request.headers.get("user-agent") ?? "none"}` +
        ` hasAuthHeader=${request.headers.get("authorization") !== null}`
    );
    return false;
  }
  return true;
}

/**
 * Is the cron secret configured at all?
 *
 * A boolean, never the value. Surfaced in /admin so an operator can see the one
 * remaining piece of configuration without reading logs or guessing from an
 * empty heartbeat — the state this project was in for its whole life.
 */
export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET);
}
