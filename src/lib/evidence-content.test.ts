import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentReport } from "@/lib/evidence";

/**
 * THE EVIDENCE PACK CLAIMED A CHECK THAT DID NOT EXIST.
 *
 * verifyChain proves LINKAGE — every row carries its predecessor's hash —
 * which detects removal, reordering and insertion. Its docstring then said
 * content-level tampering "is what the stored hash itself protects against;
 * recomputing that is done in the database, where the canonical expression
 * lives", and the pack told the reader that a שינוי in a signed row would
 * break the chain.
 *
 * Nothing recomputed it. No database function existed, nothing called one, and
 * the claim pointed at a mechanism that had never been built — in the one
 * document whose entire purpose is provability. A disclosure that defers to
 * something absent is worse than none, because the reader stops looking.
 *
 * The exposure, precisely: task_events has only INSERT and SELECT policies, so
 * no session can alter a row, and linkage already covered insertion and
 * removal. What was unchecked is tampering through the service role or direct
 * database access — exactly the threat a content hash exists for.
 *
 * Verified against production after migration 032: Timedox 6 signed rows, 0
 * mismatched; Hastickeria 2 rows predating the trigger; and a caller who is
 * not the owner or a member gets no rows at all.
 */
describe("a failed read is never reported as intact", () => {
  it("is unavailable when the database gave no answer", () => {
    // The single most important case. An integrity report that treats its own
    // blind spot as a pass is the failure this whole feature exists to avoid.
    const report = contentReport(null);
    expect(report.verdict).toBe("unavailable");
    expect(report.verdict).not.toBe("intact");
  });

  it("says so in the reader's language rather than staying silent", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/evidence/export/route.ts"),
      "utf8"
    );
    expect(route).toContain("לא הצלחנו לאמת את תוכן הרשומות");
  });
});

describe("the four verdicts are distinct", () => {
  it("intact when every signed row re-derives", () => {
    const report = contentReport({ checked: 6, mismatched: 0, firstBadSeq: null, unsigned: 1 });
    expect(report.verdict).toBe("intact");
    expect(report.checked).toBe(6);
  });

  it("tampered when any row does not, and names where", () => {
    const report = contentReport({ checked: 6, mismatched: 2, firstBadSeq: 7, unsigned: 0 });
    expect(report.verdict).toBe("tampered");
    expect(report.mismatched).toBe(2);
    expect(report.firstBadSeq).toBe(7);
  });

  it("one mismatch is enough — it does not round down to intact", () => {
    expect(contentReport({ checked: 100, mismatched: 1, firstBadSeq: 42, unsigned: 0 }).verdict).toBe(
      "tampered"
    );
  });

  it("nothing_signed when the trail predates the trigger entirely", () => {
    // Hastickeria's real state. Distinct from intact: there is nothing to
    // prove, which is not the same as having proved it.
    const report = contentReport({ checked: 0, mismatched: 0, firstBadSeq: null, unsigned: 2 });
    expect(report.verdict).toBe("nothing_signed");
  });
});

describe("linkage and content are reported separately", () => {
  /**
   * They prove different things and can disagree: a chain can link perfectly
   * while a row's content no longer matches its own hash. Collapsing them into
   * one boolean would hide precisely the case this was added for.
   */
  const route = readFileSync(
    join(process.cwd(), "src/app/api/evidence/export/route.ts"),
    "utf8"
  );

  it("the pack carries a content block of its own", () => {
    expect(route).toContain("content: {");
    expect(route).toContain("verdict: content.verdict");
  });

  it("it is fed by the database function, not by a second JS hash", () => {
    // Reproducing the hash expression in JS would be a second definition of
    // what was signed, and it would accuse untouched rows the moment the two
    // drifted — the worst failure this feature can have.
    expect(route).toContain('supabase.rpc("task_events_content_ok"');
  });

  it("the method line states what was actually re-derived", () => {
    expect(contentReport(null).method).toMatch(/re-derived from its stored fields/);
  });
});

describe("the writer and the verifier share one payload expression", () => {
  /**
   * The migration's own argument, asserted: two copies of the hashed-bytes
   * expression would let the verifier drift from the trigger and report
   * tampering on rows nobody touched — a false accusation in a document meant
   * to prove good standing. Exactly the duplication class this codebase has
   * been removing all session.
   */
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/032_evidence_content_check.sql"),
    "utf8"
  );

  it("defines the payload once", () => {
    expect(sql.match(/create or replace function public\.task_events_payload/g)).toHaveLength(1);
  });

  it("the trigger uses it", () => {
    expect(sql).toContain("public.task_events_payload(new)");
  });

  it("the verifier uses it too", () => {
    expect(sql).toContain("public.task_events_payload(e)");
  });

  it("neither spells the field list itself", () => {
    // The field concatenation must appear exactly once in the whole migration.
    expect(sql.match(/coalesce\(e\.detail, ''\)/g)).toHaveLength(1);
  });

  it("the verifier refuses a caller who may not read the business", () => {
    expect(sql).toContain("is_business_member(target)");
    expect(sql).toContain("b.owner_id = auth.uid()");
  });
});
