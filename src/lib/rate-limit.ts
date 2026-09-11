import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting that actually limits.
 *
 * The previous implementation kept its counters in a module-level `Map`. On
 * Vercel each invocation may run in a fresh isolate, so the counter was
 * effectively always 1 and the limiter did nothing whatsoever — while looking,
 * in code review, exactly like a working rate limiter. It was also wired to a
 * single endpoint.
 *
 * The counter now lives in Postgres (migration 018) and is incremented inside
 * one atomic statement. That atomicity is the point: read-then-increment in the
 * application lets two simultaneous requests both observe `limit - 1` and both
 * pass.
 */

export interface RateLimitResult {
  ok: boolean;
  /** How many hits are left in this window (0 once blocked). */
  remaining: number;
  retryAfterSeconds: number;
  /**
   * True when the limiter itself could not run. Callers decide what that means
   * for them — see the note on `check`.
   */
  degraded?: boolean;
}

/**
 * Counts a hit against `key` and says whether to allow it.
 *
 * FAIL-OPEN, deliberately, and this is the one place in this codebase where
 * that is the right call. If the database is unreachable, failing closed would
 * turn a database blip into "nobody can sign up" — a self-inflicted outage on
 * the strength of a *rate limiter*. The abuse this prevents is inconvenience;
 * the failure it would cause is denial of service to real users. Callers that
 * genuinely need fail-closed behaviour can inspect `degraded`.
 */
export async function check(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("rate_limit_hit failed", key, error.message);
      return { ok: true, remaining: limit, retryAfterSeconds: 0, degraded: true };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.error("rate_limit_hit returned no row", key);
      return { ok: true, remaining: limit, retryAfterSeconds: 0, degraded: true };
    }

    const count = Number(row.current_count ?? 0);
    return {
      ok: Boolean(row.allowed),
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    };
  } catch (err) {
    console.error("rate limiter unavailable", key, err);
    return { ok: true, remaining: limit, retryAfterSeconds: 0, degraded: true };
  }
}

/**
 * The client IP, taken from the platform's own header only.
 *
 * The previous version read the left-most entry of `x-forwarded-for`, which is
 * whatever the CLIENT sent — so any caller could spoof a fresh IP per request
 * and the limiter never saw the same key twice. Vercel sets `x-vercel-forwarded-for`
 * itself and it cannot be forged by the client, so that is preferred; the
 * RIGHT-most `x-forwarded-for` entry is the fallback, because the trusted proxy
 * appends rather than prepends.
 */
export function clientIp(request: Request): string {
  const platform = request.headers.get("x-vercel-forwarded-for");
  if (platform) return platform.split(",")[0].trim();

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    // Right-most: the entry appended by the proxy closest to us, rather than the
    // left-most one the client is free to invent.
    if (parts.length > 0) return parts[parts.length - 1];
  }

  // A single shared bucket for unidentifiable callers is still better than
  // letting them through unmetered.
  return "unknown";
}

/** Caps a free-text field from a public form before it reaches the database. */
export function capLength(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
