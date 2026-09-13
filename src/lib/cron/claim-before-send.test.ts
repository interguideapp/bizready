import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The right to send is claimed before sending, not checked before sending.
 *
 * The old pair failed open in BOTH directions. alreadySent discarded its
 * query's error, so a database hiccup read as "not sent yet" and the digest
 * went out again; logSent never checked its insert, so a failed write left a
 * delivered message unrecorded and the next sweep sent it a second time. Two
 * concurrent sweeps could also both read "not sent" and both send.
 *
 * That mattered far more after two changes made earlier today, which is the
 * point worth recording: the lazy sweep now runs whenever reminders are DUE
 * rather than waiting for stale, and a run where every tenant failed is now
 * recorded as failed, which correctly leaves the job due so it retries hourly.
 * Each retry was another chance to duplicate. WhatsApp is billed per message.
 *
 * reminder_log carries UNIQUE (business_id, channel, dedupe_key) — verified
 * against the live schema — so the insert IS the lock: whoever lands the row
 * owns the send and everyone else is told no.
 *
 * Asserted at the source, because exercising it would mean a fake Supabase
 * that models a unique constraint, which would be asserting my model of
 * Postgres rather than the code.
 */
const route = readFileSync(
  join(process.cwd(), "src/app/api/cron/reminders/route.ts"),
  "utf8"
);
const shipped = route
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

const CHANNELS = ["email", "push", "whatsapp"];

describe("the check-then-send pair is gone", () => {
  it("no longer reads before deciding", () => {
    expect(shipped).not.toContain("alreadySent");
  });

  it("no longer records after sending", () => {
    expect(shipped).not.toContain("logSent");
  });

  it("claims by inserting, so the unique constraint is the lock", () => {
    const at = shipped.indexOf("async function claimSend");
    expect(at).toBeGreaterThan(-1);
    const fn = shipped.slice(at, at + 500);
    expect(fn).toContain('.from("reminder_log")');
    expect(fn).toContain(".insert(");
    // The whole point: only a clean insert is a claim. This asserted
    // `return !error` and broke when the two failure kinds were split apart —
    // correctly, which is what it is for.
    expect(fn).toContain('if (!error) return "claimed";');
  });
});

describe("every channel claims first", () => {
  it("gates each send on the claim", () => {
    // Via the per-business `claim` helper, which also counts the broken case.
    // This named claimSend directly and broke when that indirection arrived.
    for (const channel of CHANNELS) {
      expect(shipped, `${channel} does not claim first`).toContain(
        `(await claim("${channel}"))`
      );
    }
    expect(shipped).toContain("claimSend(supabase, biz.id, channel, digestKey)");
  });

  it("releases the claim when the send did not happen", () => {
    // Otherwise claiming first turns a transient provider error into a
    // silently skipped day, which is the opposite failure.
    for (const channel of CHANNELS) {
      expect(shipped, `${channel} never releases`).toContain(
        `releaseSend(supabase, biz.id, "${channel}", digestKey)`
      );
    }
  });

  it("counts a channel as sent only when it actually delivered", () => {
    expect(shipped).toContain("if (res.ok) emailsSent++;");
    expect(shipped).toContain("if (res.ok) whatsappSent++;");
    expect(shipped).toContain("if (anyDelivered) pushSent++;");
  });
});

describe("releaseSend only removes its own claim", () => {
  it("is keyed on all three columns of the unique constraint", () => {
    const at = shipped.indexOf("async function releaseSend");
    expect(at).toBeGreaterThan(-1);
    const fn = shipped.slice(at, at + 500);
    expect(fn).toContain(".delete()");
    for (const col of ["business_id", "channel", "dedupe_key"]) {
      expect(fn, `release is not scoped by ${col}`).toContain(`.eq("${col}"`);
    }
  });
});

describe("a broken claim is distinguished from an already-sent one", () => {
  /**
   * A blind spot I opened with the change above, and closed in the same hour.
   *
   * The first version returned !error, so "already sent" and "the insert is
   * broken" were the same answer: skip. Skipping is right for both, but they
   * are not the same NEWS. If claims failed systematically — a policy changed,
   * the table moved — outbound would stop entirely while every business still
   * succeeded: no tenant throws, emailsSent is simply 0, and fanOutSucceeded
   * would call the run healthy. Silent total stoppage reported as a good night
   * is exactly the failure this session keeps removing.
   */
  it("names the three outcomes rather than returning a boolean", () => {
    expect(shipped).toContain('"claimed" | "already-sent" | "unavailable"');
  });

  it("treats only a unique violation as already-sent", () => {
    // 23505 is Postgres unique_violation: the expected way to lose a claim.
    expect(shipped).toContain("23505");
    expect(shipped).toContain('error.code === UNIQUE_VIOLATION ? "already-sent" : "unavailable"');
  });

  it("counts the unavailable case", () => {
    expect(shipped).toContain("claimsUnavailable++");
    expect(shipped).toContain('if (result === "unavailable") claimsUnavailable++');
  });

  it("reports it, so an operator can see why nothing went out", () => {
    const summaryAt = shipped.indexOf("const summary = {");
    expect(summaryAt).toBeGreaterThan(-1);
    expect(shipped.slice(summaryAt, summaryAt + 500)).toContain("claimsUnavailable,");
  });

  it("fails the run when NO claim could be taken, by the same rule as tenants", () => {
    /**
     * This asserted `claimsUnavailable === 0`, and that is the assertion that
     * caught the inconsistency: requiring zero meant ONE business with an odd
     * claim error failed the whole run, which sets `failing`, which makes
     * jobIsDown true, which tells EVERY user delivery is down. That is the
     * trade-off refused one commit earlier for per-business throws and then
     * taken the opposite way in the same expression.
     *
     * Some claims failing is a tenant problem; all of them failing is the
     * mechanism. Same question, same function.
     */
    expect(shipped).toContain("fanOutSucceeded(claimsAttempted, claimsUnavailable)");
    expect(shipped, "one tenant's claim error fails the whole run again").not.toContain(
      "claimsUnavailable === 0"
    );
  });

  it("counts the attempts, or the boundary has nothing to compare against", () => {
    expect(shipped).toContain("claimsAttempted++");
    const summaryAt = shipped.indexOf("const summary = {");
    expect(shipped.slice(summaryAt, summaryAt + 600)).toContain("claimsAttempted,");
  });

  it("still skips quietly when the digest was genuinely already sent", () => {
    // The common case must not be reported as a fault, or the signal is noise
    // from the second sweep of every day onwards.
    const at = shipped.indexOf("const claim = async");
    expect(at).toBeGreaterThan(-1);
    const helper = shipped.slice(at, at + 400);
    expect(helper).toContain('result === "unavailable"');
    expect(helper).not.toContain('result === "already-sent"');
  });
});
