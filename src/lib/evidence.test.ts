import { describe, expect, it } from "vitest";
import { verifyChain, type EvidenceEvent } from "./evidence";

const ev = (id: string, hash: string | null, prev: string | null): EvidenceEvent => ({
  id,
  created_at: "2026-09-01T00:00:00Z",
  kind: "completed",
  template_id: "open-vat-file",
  from_status: "todo",
  to_status: "done",
  detail: null,
  hash,
  prev_hash: prev,
});

describe("verifyChain", () => {
  it("reports not-verifiable when no row carries a hash (pre-migration)", () => {
    const r = verifyChain([ev("a", null, null), ev("b", null, null)]);
    expect(r.verifiable).toBe(false);
    expect(r.checked).toBe(0);
    expect(r.unverified).toBe(2);
  });

  it("counts the rows that predate the chain, so the pack cannot overclaim", () => {
    // This is the state production is actually in: three events were written
    // before the hash trigger existed, and everything after them is signed.
    // The old report said linked:true / checked:2 and the export turned that
    // into "every record is signed and linked" — false for rows a and b.
    const r = verifyChain([
      ev("a", null, null),
      ev("b", null, null),
      ev("c", "h1", null),
      ev("d", "h2", "h1"),
    ]);
    expect(r.verifiable).toBe(true);
    expect(r.linked).toBe(true);
    expect(r.checked).toBe(2);
    expect(r.unverified).toBe(2);
  });

  it("reports zero unverified when the whole trail is signed", () => {
    const r = verifyChain([ev("a", "h1", null), ev("b", "h2", "h1")]);
    expect(r.unverified).toBe(0);
  });

  it("accepts a correctly linked chain", () => {
    const r = verifyChain([ev("a", "h1", null), ev("b", "h2", "h1"), ev("c", "h3", "h2")]);
    expect(r.verifiable).toBe(true);
    expect(r.linked).toBe(true);
    expect(r.brokenAt).toBeNull();
    expect(r.checked).toBe(3);
  });

  it("detects a removed row", () => {
    // b was deleted, so c still points at h2 which is no longer present
    const r = verifyChain([ev("a", "h1", null), ev("c", "h3", "h2")]);
    expect(r.linked).toBe(false);
    expect(r.brokenAt).toBe("c");
  });

  it("detects a reordered row", () => {
    const r = verifyChain([ev("a", "h1", null), ev("c", "h3", "h2"), ev("b", "h2", "h1")]);
    expect(r.linked).toBe(false);
    expect(r.brokenAt).toBe("c");
  });

  it("detects an inserted row", () => {
    const r = verifyChain([ev("a", "h1", null), ev("x", "hx", "forged"), ev("b", "h2", "h1")]);
    expect(r.linked).toBe(false);
    expect(r.brokenAt).toBe("x");
  });

  it("ignores rows with no hash rather than failing the whole chain", () => {
    const r = verifyChain([ev("a", "h1", null), ev("legacy", null, null), ev("b", "h2", "h1")]);
    expect(r.linked).toBe(true);
    expect(r.checked).toBe(2);
  });
});
