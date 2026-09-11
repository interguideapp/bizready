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
  /** false when the rows carry no hashes yet (migration 014 not applied) */
  verifiable: boolean;
  /** true when every row links to its predecessor */
  linked: boolean;
  /** id of the first row whose prev_hash does not match its predecessor */
  brokenAt: string | null;
  checked: number;
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
  if (hashed.length === 0) {
    return { verifiable: false, linked: false, brokenAt: null, checked: 0, method };
  }

  let prev: string | null = null;
  for (const e of hashed) {
    // the first hashed row may legitimately have a null prev_hash
    const expected = prev;
    const actual = e.prev_hash ?? null;
    if (prev !== null && actual !== expected) {
      return { verifiable: true, linked: false, brokenAt: e.id, checked: hashed.length, method };
    }
    prev = e.hash ?? null;
  }
  return { verifiable: true, linked: true, brokenAt: null, checked: hashed.length, method };
}
