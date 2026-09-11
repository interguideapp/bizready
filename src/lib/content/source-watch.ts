import { createHash } from "node:crypto";

/**
 * Source watching: has the page a claim was read from actually changed?
 *
 * `review-queue.ts` answers "what have we not looked at lately", which is a
 * calendar question. This answers the harder one — "what moved" — because a
 * rule can change the week after it was reviewed, and age alone will never
 * catch that. Together they are the regulatory-change detection the product
 * markets on its own landing page ("מבוסס על מקורות רשמיים ומתעדכן כשהחוק
 * משתנה"), which until now was a claim with no mechanism behind it.
 *
 * The hard part is not fetching. It is not crying wolf. A gov.il page carries a
 * session token, a build id, a rotating banner and a "last visited" widget, so
 * a naive hash of the response body changes on every single fetch and the
 * watcher becomes noise that gets muted within a week. So the body is
 * normalised aggressively before hashing, and the module is honest that this is
 * a heuristic: a changed checksum means LOOK, never "the law changed".
 */

/** One watched source and the fingerprint we last saw. */
export interface SourceFingerprint {
  url: string;
  /** sha256 of the normalised text. */
  checksum: string;
  /** Length of the normalised text — a cheap sanity signal alongside the hash. */
  length: number;
  checkedAt: string;
}

export type SourceVerdict =
  /** Same as last time, within the tolerance below. */
  | { status: "unchanged"; checksum: string }
  /** Meaningfully different. Route to a human; do NOT auto-update content. */
  | { status: "changed"; checksum: string; previousChecksum: string; lengthDelta: number }
  /** First time we have seen it — record the baseline, raise nothing. */
  | { status: "baseline"; checksum: string }
  /** We could not tell. Never reported as unchanged. */
  | { status: "unavailable"; reason: string };

/**
 * Strips everything that changes on its own from a fetched page.
 *
 * Each removal below exists because leaving it in produces a false positive on
 * every fetch. The aim is the prose a human would read, and nothing else.
 */
export function normaliseSource(html: string): string {
  return (
    html
      // Scripts and styles carry build hashes and inlined state.
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      // Comments hold build ids and server timestamps.
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Tags themselves: a class name changing is not a rule changing.
      .replace(/<[^>]+>/g, " ")
      // Entities, so &nbsp; and a space are not different content.
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      // Dates in any common form — "last updated" stamps move daily.
      .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, " ")
      .replace(/\d{4}-\d{2}-\d{2}/g, " ")
      // Long digit runs: session ids, tokens, view counters. Kept short runs,
      // because 15, 22 and 31 are the dates and amounts we actually care about.
      .replace(/\d{6,}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

export function fingerprint(html: string): { checksum: string; length: number } {
  const text = normaliseSource(html);
  return {
    checksum: createHash("sha256").update(text, "utf8").digest("hex"),
    length: text.length,
  };
}

/**
 * Below this proportional change, treat the page as unchanged.
 *
 * Not zero, deliberately. Even after normalisation these pages wobble by a few
 * characters — a rotated promo line, a reordered menu. A watcher that fires on
 * a 0.1% delta gets muted, and a muted watcher detects nothing at all. Tuned to
 * let a genuine content edit through while absorbing chrome.
 */
export const CHANGE_TOLERANCE = 0.02;

/**
 * Compares a freshly fetched page against the last fingerprint.
 *
 * Note the asymmetry: an identical checksum with a length change beyond
 * tolerance is impossible, but a DIFFERENT checksum within tolerance is
 * common — the same words with a character shuffled somewhere. So the checksum
 * alone is too twitchy to gate on, and length is the corroborating signal.
 */
export function compareSource(
  html: string,
  previous: SourceFingerprint | null
): SourceVerdict {
  const { checksum, length } = fingerprint(html);

  if (length === 0) {
    // An empty page after normalisation means we fetched a redirect, a login
    // wall or an error page. Reporting "unchanged" here would be the worst
    // outcome: silently confirming content we never actually read.
    return { status: "unavailable", reason: "the page had no readable text" };
  }

  if (!previous) return { status: "baseline", checksum };
  if (previous.checksum === checksum) return { status: "unchanged", checksum };

  const delta = Math.abs(length - previous.length);
  const proportion = previous.length > 0 ? delta / previous.length : 1;
  if (proportion < CHANGE_TOLERANCE) {
    return { status: "unchanged", checksum };
  }

  return {
    status: "changed",
    checksum,
    previousChecksum: previous.checksum,
    lengthDelta: length - previous.length,
  };
}

/**
 * What to tell the reviewer. Deliberately not "the law changed".
 *
 * The product's credibility rests on not overclaiming, and a checksum cannot
 * distinguish a redrafted regulation from a reorganised web page. It can only
 * say where to look.
 */
export function changeNotice(url: string, verdict: SourceVerdict): string | null {
  switch (verdict.status) {
    case "changed":
      return `הדף הרשמי ${url} השתנה מאז הבדיקה האחרונה (${
        verdict.lengthDelta > 0 ? "+" : ""
      }${verdict.lengthDelta} תווים). זה לא אומר שהחוק השתנה — זה אומר שצריך לקרוא ולאשר.`;
    case "unavailable":
      return `לא הצלחנו לקרוא את ${url} (${verdict.reason}). בדקו ידנית.`;
    default:
      return null;
  }
}
