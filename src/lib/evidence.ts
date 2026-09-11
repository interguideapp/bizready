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
