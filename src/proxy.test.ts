import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MACHINE_PATHS, PUBLIC_PATHS } from "@/proxy";

/**
 * Which requests the proxy is allowed to redirect to /login.
 *
 * The matcher catches every path but static assets, so anything not listed
 * here gets a 307 to /login before its route handler runs. For a browser that
 * is the point. For a machine it is fatal, and it WAS fatal: verified on live
 * production, /api/cron/daily, /api/billing/webhook, /api/hooks/<token> and
 * /api/auth/username-register all returned the login page. No reminder, no
 * Stripe event, no invoicing callback and no username registration had ever
 * reached its handler.
 *
 * The audit left this as an open question — "either the proxy blocks Vercel
 * Cron or it doesn't intercept route handlers; one of the two is wrong today —
 * verify, don't assume" — and nobody verified it. These tests are that
 * verification, kept.
 */

const root = process.cwd();
const covered = (pathname: string) =>
  [...PUBLIC_PATHS, ...MACHINE_PATHS].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

describe("every machine-called endpoint is let through", () => {
  it("lets the cron dispatcher and each individual job through", () => {
    for (const job of ["daily", "reminders", "sync", "retention", "source-watch"]) {
      expect(covered(`/api/cron/${job}`), job).toBe(true);
    }
  });

  it("lets the Stripe webhook through", () => {
    // 019 makes the subscription columns unwritable by any session, so this
    // webhook is the only thing that can ever grant Pro. Blocked, a paying
    // customer stayed on the free tier.
    expect(covered("/api/billing/webhook")).toBe(true);
  });

  it("lets an inbound invoicing webhook through, token and all", () => {
    expect(covered("/api/hooks/9f3c1d0e-token")).toBe(true);
  });

  it("lets username registration through, which is pre-auth by definition", () => {
    expect(covered("/api/auth/username-register")).toBe(true);
  });
});

describe("nothing else was widened", () => {
  it("still guards the endpoints that return tax and bank details", () => {
    // A blanket /api bypass would have fixed the machine routes by removing a
    // layer from these. They resolve the session themselves, but the proxy
    // stays in front of them.
    for (const p of [
      "/api/passport/print",
      "/api/evidence/export",
      "/api/privacy/export",
      "/api/documents/print/invoice",
    ]) {
      expect(covered(p), p).toBe(false);
    }
  });

  it("still guards the app's own pages", () => {
    for (const p of ["/home", "/calendar", "/insights", "/notifications", "/admin"]) {
      expect(covered(p), p).toBe(false);
    }
  });

  it("does not let /api through wholesale", () => {
    expect(covered("/api")).toBe(false);
    expect(covered("/api/push/subscribe")).toBe(false);
  });
});

describe("the allowlist matches the routes that actually exist", () => {
  it("covers every route whose auth is not a user session", () => {
    // A machine endpoint added later and not listed here would be redirected
    // to /login and fail silently — exactly how this went unnoticed. So the
    // check is derived from the routes on disk, not from a remembered list.
    const routes = readFileSync(join(root, "src/proxy.ts"), "utf8");
    expect(routes).toContain("MACHINE_PATHS");

    const machineAuthMarkers = /cronAuthorized|stripe-signature|webhook_secret|clientIp/;
    const apiDir = join(root, "src/app/api");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return full.endsWith("route.ts") ? [full] : [];
      });
    const unlisted: string[] = [];
    for (const file of walk(apiDir)) {
      if (!machineAuthMarkers.test(readFileSync(file, "utf8"))) continue;
      // Normalise Windows separators and drop the trailing /route.ts.
      // split/join rather than replace: a backslash in a replacement string is
      // an escape, which has bitten this repo more than once.
      const rel = file.slice(apiDir.length).split("\\").join("/");
      const urlPath = "/api" + rel.slice(0, rel.length - "/route.ts".length);
      if (!covered(urlPath)) unlisted.push(urlPath);
    }
    expect(unlisted).toEqual([]);
  });
});
