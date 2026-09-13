import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS } from "@/proxy";

/**
 * The service worker script has to be fetchable without a session.
 *
 * Found by loading the deployed site and reading the browser console, which is
 * the one technique I had not tried. It reported "The script resource is behind
 * a redirect, which is disallowed" — and a live curl confirmed why:
 *
 *   GET /sw.js                 -> 307 -> /login
 *   GET /manifest.webmanifest  -> 307 -> /login
 *   GET /icon-192.png          -> 200
 *
 * The proxy matcher excluded image extensions and not these two. Chrome refuses
 * a script resource behind a redirect, so registration failed on EVERY visit:
 * the service worker has never registered in production, there is no offline
 * page, and push notifications are impossible because serviceWorker.ready
 * never resolves.
 *
 * It is the same bug class as MACHINE_PATHS — a request carrying no session
 * cookie, sent to a path that never needed one — which had already been found
 * once for cron triggers and Stripe webhooks and was not generalised to the
 * PWA assets.
 */
const root = process.cwd();
const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");

/** The matcher line, which is where a static file gets excluded. */
/**
 * The matcher line with backslashes stripped.
 *
 * Asserting the escaped form directly means counting backslash levels across
 * a file read, a JS string and a regex — which is how eight edits in this
 * session silently lost one. The question is which NAMES are excluded, so the
 * escapes are removed before asking.
 */
const matcher = proxy
  .split("\n")
  .find((l) => l.includes("_next/static"))!
  .split("\\\\")
  .join("");

describe("every PWA asset bypasses the proxy", () => {
  it("excludes the service worker script", () => {
    expect(matcher).toContain("sw\.js");
  });

  it("excludes the web manifest", () => {
    // Not fatal like the script, but it is fetched without a cookie too and a
    // redirected manifest means no install prompt and no icons.
    expect(matcher).toContain("manifest\.webmanifest");
  });

  it("still excludes what it already did", () => {
    // The fix must not have traded one exclusion for another.
    for (const kept of ["_next/static", "_next/image", "favicon.ico", "svg|png"]) {
      expect(matcher, `${kept} is no longer excluded`).toContain(kept);
    }
  });

  it("covers every static file actually in public/", () => {
    /**
     * Derived from the directory rather than a hand-kept list, so a PWA asset
     * added later cannot quietly start redirecting to /login. Images are
     * covered by the extension group; anything else needs naming.
     */
    const IMAGE = /\.(svg|png|jpg|jpeg|gif|webp|ico)$/;
    const unexcluded = readdirSync(join(root, "public"))
      .filter((f) => !IMAGE.test(f))
      .filter((f) => !matcher.includes(f.replace(".", "\.")));
    expect(unexcluded).toEqual([]);
  });

  it("does not rely on PUBLIC_PATHS for them", () => {
    // PUBLIC_PATHS stops the redirect but still runs the middleware, which
    // would refresh a Supabase session on every service-worker fetch. A static
    // file should not invoke middleware at all.
    expect(PUBLIC_PATHS).not.toContain("/sw.js");
  });
});

describe("the push toggle's visibility does not wait on the worker", () => {
  const toggle = readFileSync(join(root, "src/components/push-toggle.tsx"), "utf8");

  it("sets supported without awaiting serviceWorker.ready", () => {
    /**
     * `ready` resolves when a worker is active; when registration FAILS it
     * neither resolves nor rejects, it hangs. Registration was failing on every
     * visit, so neither the .then nor the .catch ran, supported stayed false,
     * and the toggle was invisible rather than visible-but-broken — the push
     * channel gone from the UI entirely. My own change, meeting a bug that was
     * already there.
     */
    const at = toggle.indexOf("Promise.resolve().then(");
    expect(at, "supported is gated on ready again").toBeGreaterThan(-1);
    expect(toggle.slice(at, at + 160)).toContain("setSupported(true)");
  });

  it("still asks the worker only about the subscription state", () => {
    const at = toggle.indexOf("navigator.serviceWorker.ready");
    expect(at).toBeGreaterThan(-1);
    const block = toggle.slice(at, at + 420);
    expect(block).toContain("getSubscription()");
    expect(block, "visibility is decided inside the ready chain").not.toContain(
      "setSupported"
    );
  });
});
