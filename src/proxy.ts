import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const PUBLIC_PATHS = ["/", "/login", "/auth", "/partners"];

/**
 * ENDPOINTS CALLED BY MACHINES, NOT BROWSERS.
 *
 * These must skip the session check, and the reason is not convenience: a
 * cron trigger, a Stripe webhook and an invoicing callback have no session
 * cookie and never will. The matcher below catches every path except static
 * assets, so each of these was redirected 307 to /login before its route
 * handler ran. Verified on live production — /api/cron/daily,
 * /api/billing/webhook, /api/hooks/<token> and /api/auth/username-register all
 * returned the login page.
 *
 * What that meant, all of it silent:
 *   - no reminder was ever sent, because the sweep was never reached (which is
 *     also why cron_runs was empty and the cron-auth diagnostic never fired);
 *   - no Stripe event was ever delivered, and the webhook is the ONLY writer of
 *     subscription state (019 makes those columns unwritable by any session),
 *     so nobody could become Pro even after paying;
 *   - no invoicing webhook was ever delivered, so the whole integrations
 *     feature has never received a byte;
 *   - username registration, which is by definition pre-auth, redirected the
 *     new user to the page they were already on.
 *
 * The audit raised exactly this as an open question — "either the proxy blocks
 * Vercel Cron or it doesn't intercept route handlers; one of the two is wrong
 * today — verify, don't assume" — and it was never verified. It blocks.
 *
 * NOT a blanket /api bypass. /api/passport/print and /api/evidence/export
 * return tax file numbers and bank details, and while they resolve the session
 * themselves, widening this to all of /api would remove a layer from PII
 * endpoints to fix machine ones. Every path listed here authenticates its
 * CALLER — timing-safe secret, Stripe signature, per-connection HMAC, or
 * IP rate limiting — which for a machine is stronger than a session check, not
 * weaker.
 */
export const MACHINE_PATHS = [
  "/api/cron",
  "/api/hooks",
  "/api/billing/webhook",
  "/api/auth/username-register",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  // public pages render without waiting on an auth roundtrip
  if (isPublic) return response;

  const isMachine = MACHINE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  // Straight through to the handler, which does its own, stronger check.
  if (isMachine) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // supabase unreachable — treat as signed out
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // sw.js and manifest.webmanifest are PWA assets fetched with NO session
    // cookie, so the proxy redirected both to /login. Verified live: each
    // returned 307 -> /login while icon-192.png returned 200, because images
    // were already excluded and these two were not.
    //
    // The service worker one is the expensive half. Chrome refuses a script
    // resource behind a redirect, so registration failed with "The script
    // resource is behind a redirect, which is disallowed" on every visit —
    // which means the SW has NEVER registered in production, there is no
    // offline page, and push notifications are impossible because
    // serviceWorker.ready never resolves.
    //
    // Excluded from the matcher rather than added to PUBLIC_PATHS: these are
    // static files and should not invoke middleware at all, let alone refresh
    // a Supabase session on every service-worker fetch.
    //
    // Same bug class as MACHINE_PATHS above: a request with no cookie, sent
    // to a path that never needed one.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
