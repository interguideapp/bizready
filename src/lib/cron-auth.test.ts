import { afterEach, describe, expect, it, vi } from "vitest";
import { cronAuthorized, cronSecretConfigured } from "@/lib/cron-auth";

/**
 * The guard on the routes that run with the service role.
 *
 * It fails closed, which is right, and for the whole life of this project that
 * was indistinguishable from never being called: production's `cron_runs` table
 * was empty, which fits both "the schedule was never registered" (it wasn't —
 * four cron entries on a plan allowing two) and "it fired and was rejected
 * here". Nothing recorded which. Both faults now say so, in the log and in
 * /admin.
 */
const SECRET = "s".repeat(48);

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/cron/daily", { headers });
}

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe("authorization", () => {
  it("refuses everything when no secret is configured", () => {
    // The default. Never an open door.
    expect(cronAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(false);
  });

  it("accepts the matching bearer token", () => {
    process.env.CRON_SECRET = SECRET;
    expect(cronAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it("refuses a wrong secret of the same length", () => {
    // Same length so the comparison runs rather than short-circuiting.
    process.env.CRON_SECRET = SECRET;
    expect(cronAuthorized(req({ authorization: `Bearer ${"x".repeat(48)}` }))).toBe(false);
  });

  it("refuses a missing header", () => {
    process.env.CRON_SECRET = SECRET;
    expect(cronAuthorized(req())).toBe(false);
  });

  it("refuses a bare token without the Bearer prefix", () => {
    process.env.CRON_SECRET = SECRET;
    expect(cronAuthorized(req({ authorization: SECRET }))).toBe(false);
  });
});

describe("the two failures are told apart", () => {
  it("says the secret is missing when it is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cronAuthorized(req({ "user-agent": "vercel-cron/1.0" }));
    expect(warn.mock.calls[0][0]).toContain("CRON_SECRET is not set");
  });

  it("says the secret is set but wrong when it is set but wrong", () => {
    // This is the distinction that was missing: one is a configuration gap,
    // the other is a mismatch, and they have different fixes.
    process.env.CRON_SECRET = SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cronAuthorized(req({ authorization: "Bearer nope", "user-agent": "vercel-cron/1.0" }));
    expect(warn.mock.calls[0][0]).toContain("CRON_SECRET is set but");
  });

  it("records whether the caller looked like Vercel Cron", () => {
    // "Fired and rejected" versus "random internet scan" is the difference
    // between a configuration problem and noise.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cronAuthorized(req({ "user-agent": "vercel-cron/1.0" }));
    expect(warn.mock.calls[0][0]).toContain("vercel-cron/1.0");
  });

  it("never puts the secret itself in a log line", () => {
    process.env.CRON_SECRET = SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cronAuthorized(req({ authorization: `Bearer ${"x".repeat(48)}` }));
    for (const call of warn.mock.calls) {
      expect(String(call[0])).not.toContain(SECRET);
    }
  });

  it("says nothing at all on success", () => {
    // A guard that logs on the happy path is a guard people filter out.
    process.env.CRON_SECRET = SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(cronAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("configuration state, for the admin panel", () => {
  it("reports a boolean and never the value", () => {
    expect(cronSecretConfigured()).toBe(false);
    process.env.CRON_SECRET = SECRET;
    expect(cronSecretConfigured()).toBe(true);
  });
});
