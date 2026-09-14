/**
 * The evidence pack: the timestamped, verifiable record a business would put in
 * front of an accountant or an authority.
 *
 * Before this, the only export was the passport PDF — and its task_events query
 * was used solely to compute a gamification streak, so the exported artifact
 * contained a score, a level and badges, but not a single timestamped action.
 */

export interface EvidenceEvent {
  id: string;
  created_at: string;
  kind: string;
  template_id: string | null;
  from_status: string | null;
  to_status: string | null;
  detail: string | null;
  actor_kind?: string | null;
  actor_id?: string | null;
  prev_hash?: string | null;
  hash?: string | null;
}

export interface ChainReport {
  /** false when NO row carries a hash, so there is no chain to check at all */
  verifiable: boolean;
  /** true when every row links to its predecessor */
  linked: boolean;
  /** id of the first row whose prev_hash does not match its predecessor */
  brokenAt: string | null;
  checked: number;
  /**
   * Rows that predate the chain and therefore sit OUTSIDE it.
   *
   * This number is the difference between an honest report and a false one.
   * The chain was added by migration 014 and only signs rows written after it,
   * so an account that existed before it has unsigned rows at the head of its
   * history. Reporting "linked" while quietly checking a subset would claim the
   * whole trail is provable when part of it is not — in the one document whose
   * entire purpose is provability.
   */
  unverified: number;
  /** what this check does and does not prove, in plain language */
  method: string;
}

/**
 * Verify the hash chain's LINKAGE: every row must carry the previous row's
 * hash. Removing, reordering or inserting a row breaks the link and is detected
 * here without needing to reproduce Postgres's hash expression in JS.
 *
 * Content-level tampering (editing a detail in place) is what the stored hash
 * itself protects against; recomputing that is done in the database, where the
 * canonical expression lives. Events must be passed oldest-first.
 */
export function verifyChain(events: EvidenceEvent[]): ChainReport {
  const method =
    "linkage: each row must carry its predecessor's hash. Detects removal, " +
    "reordering and insertion. Content edits are covered by the stored hash itself.";

  const hashed = events.filter((e) => e.hash);
  const unverified = events.length - hashed.length;
  if (hashed.length === 0) {
    return {
      verifiable: false,
      linked: false,
      brokenAt: null,
      checked: 0,
      unverified,
      method,
    };
  }

  let prev: string | null = null;
  for (const e of hashed) {
    // the first hashed row may legitimately have a null prev_hash
    const expected = prev;
    const actual = e.prev_hash ?? null;
    if (prev !== null && actual !== expected) {
      return {
        verifiable: true,
        linked: false,
        brokenAt: e.id,
        checked: hashed.length,
        unverified,
        method,
      };
    }
    prev = e.hash ?? null;
  }
  return {
    verifiable: true,
    linked: true,
    brokenAt: null,
    checked: hashed.length,
    unverified,
    method,
  };
}

/**
 * THE CONTENT CHECK THE PACK WAS ALREADY CLAIMING.
 *
 * verifyChain above checks LINKAGE — every row carries its predecessor's hash
 * — which detects removal, reordering and insertion. Its own docstring then
 * said content-level tampering "is what the stored hash itself protects
 * against; recomputing that is done in the database, where the canonical
 * expression lives", and the pack told the reader that a שינוי in a signed row
 * would break the chain.
 *
 * Nothing recomputed it. There was no database function, nothing called one,
 * and the claim pointed at a mechanism that had never been built — in the one
 * document whose entire purpose is provability. A disclosure that defers to
 * something absent is worse than none, because the reader stops looking.
 *
 * Worth being precise about the exposure. task_events has only INSERT and
 * SELECT policies — no UPDATE, no DELETE — so no session can alter a row, and
 * linkage already covered insertion and removal. What was unchecked is
 * tampering through the service role or direct database access, which is
 * exactly the threat a content hash exists for.
 *
 * Migration 032 adds task_events_content_ok, which re-derives every signed
 * row's hash from its stored content through the SAME payload expression the
 * writing trigger uses — one expression, so the verifier cannot drift from the
 * writer and accuse an untouched row, which on this feature is the worst
 * possible failure.
 */
export interface ContentCounts {
  checked: number;
  mismatched: number;
  firstBadSeq: number | null;
  unsigned: number;
}

export type ContentVerdict = "intact" | "tampered" | "nothing_signed" | "unavailable";

export interface ContentReport {
  verdict: ContentVerdict;
  checked: number;
  mismatched: number;
  firstBadSeq: number | null;
  /** What this check proves, in plain language, for the pack's method line. */
  method: string;
}

/**
 * Turn the database counts into a verdict.
 *
 * `null` counts mean the read failed or the caller may not see the business,
 * and that is "unavailable" — never "intact". An integrity report that reads a
 * failure as a pass is the single worst thing this file could do.
 */
export function contentReport(counts: ContentCounts | null): ContentReport {
  const method =
    "content: every signed row's hash is re-derived from its stored fields in " +
    "the database, through the same expression that wrote it. Detects an " +
    "in-place edit, which the linkage check cannot.";
  if (!counts) {
    return { verdict: "unavailable", checked: 0, mismatched: 0, firstBadSeq: null, method };
  }
  if (counts.checked === 0) {
    return {
      verdict: "nothing_signed",
      checked: 0,
      mismatched: 0,
      firstBadSeq: null,
      method,
    };
  }
  return {
    verdict: counts.mismatched > 0 ? "tampered" : "intact",
    checked: counts.checked,
    mismatched: counts.mismatched,
    firstBadSeq: counts.firstBadSeq,
    method,
  };
}
