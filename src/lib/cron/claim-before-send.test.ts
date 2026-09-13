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
    // The whole point: an error means we did NOT get the claim.
    expect(fn).toContain("return !error;");
  });
});

describe("every channel claims first", () => {
  it("gates each send on the claim", () => {
    for (const channel of CHANNELS) {
      expect(shipped, `${channel} does not claim first`).toContain(
        `await claimSend(supabase, biz.id, "${channel}", digestKey)`
      );
    }
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
