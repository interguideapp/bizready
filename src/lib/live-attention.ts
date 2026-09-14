import type { NotificationDraft } from "@/lib/reminders";
import { DOCUMENT_EXPIRY_HREF, SYNC_ERROR_HREF } from "@/lib/destinations";
import { legalBasisOf } from "@/lib/content/legal-basis";

/**
 * What needs attention right now, whether or not the nightly sweep ran.
 *
 * THE DEFECT THIS EXISTS TO REMOVE
 *
 * The only writer of deadline and overdue notifications was the cron route. So
 * if that sweep stopped — a missing CRON_SECRET (the routes fail closed by
 * design), a platform cron limit, a deploy, an exception, a database blip — the
 * notifications page said "הכל רגוע כרגע" with a VAT filing overdue.
 *
 * An affirmative all-clear produced by a broken pipeline is the worst failure
 * this product can have, and it is the same defect the audit found in data.ts:
 * a read error swallowed, rendered as "you are compliant". Missing data must
 * never be shown as good news.
 *
 * So the page no longer depends on the sweep for what it displays. It runs the
 * same pure engine (computeReminders) against the live task set and merges the
 * result with the stored rows. The sweep still matters — it is what sends email,
 * push and WhatsApp, and it owns read state — but the screen is now correct on
 * its own.
 */

/** A stored notification row, narrowed to what merging needs. */
export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  template_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AttentionItem {
  /** Stored rows keep their id; derived ones are keyed by their dedupe key. */
  key: string;
  type: string;
  title: string;
  body: string | null;
  templateId: string | null;
  /** What the sweep would key this on. Decides where an item leads. */
  dedupeKey: string | null;
  /** Days to the date this is about; null when there is no date. */
  daysUntil: number | null;
  /** Null for a derived item — it has never been stored, so it is unread. */
  storedId: string | null;
  readAt: string | null;
  createdAt: string | null;
  /**
   * True when this came from the live engine rather than the database.
   *
   * Kept on the item because it changes what the UI may promise: a derived
   * item is on screen, but nothing has been emailed or pushed for it.
   */
  derived: boolean;
}

/**
 * Where an item leads.
 *
 * Most attention items are about a task, and the task id is the destination.
 * A document expiry is not: it has no task, so it used to render as inert
 * markup — the product told a user their אישור ניהול ספרים had expired and
 * gave them nowhere to go. An item that names a problem and offers no way to
 * act on it is half a notification.
 */
export function attentionHref(item: {
  templateId: string | null;
  dedupeKey: string | null;
}): string | null {
  if (item.templateId) return `/tasks/${item.templateId}?from=notifications`;
  // A broken sync is fixed on the connection screen, which is also the only
  // place these errors were ever shown.
  if (item.dedupeKey?.startsWith("sync:")) return SYNC_ERROR_HREF;
  // Matched on the dedupe key, not on `key`: a stored row is keyed by its
  // database id, so only a derived item would ever have matched otherwise —
  // and the stored ones are exactly the notifications the cron emailed.
  if (item.dedupeKey?.startsWith("doc-expiry:") || item.dedupeKey?.startsWith("doc-expired:")) {
    // The same constant the obligations board uses for the same item. It was
    // the board that had no destination for an expiry while this one did, so
    // the answer is shared rather than written twice.
    return DOCUMENT_EXPIRY_HREF;
  }
  return null;
}

/**
 * Open sync failures, as attention items.
 *
 * TYPE_RANK has ranked a "sync" type since this file was written and NOTHING
 * ever produced one. A failed invoicing sync was recorded in sync_errors and
 * rendered on /integrations only — so a user who never opened that screen
 * never learned their sync was broken.
 *
 * That is worse than a missing convenience. The revenue figure this sync
 * maintains is what the עוסק-פטור ceiling is measured against, so a silently
 * stale figure can HIDE a real breach — the product would be quietly
 * comparing a legal threshold against numbers that stopped updating.
 *
 * Derived rather than notified, like the rest of this surface: no cron has to
 * run for the user to find out.
 */
export function syncErrorDrafts(
  errors: { id: string; message: string; occurred_at: string }[]
): NotificationDraft[] {
  if (errors.length === 0) return [];
  // One item however many errors there are. Five failures of the same broken
  // connection are one problem, and five rows would bury the deadlines this
  // list exists for.
  const newest = errors[0];
  return [
    {
      // No date to be near or past: a broken connection is about now and stays
      // about now until someone fixes it.
      days_until: null,
      type: "sync",
      title:
        errors.length === 1
          ? "הסנכרון מתוכנת החשבוניות נכשל"
          : `הסנכרון מתוכנת החשבוניות נכשל (${errors.length} שגיאות פתוחות)`,
      body:
        "המחזור שמוצג עלול להיות לא מעודכן — וגם בדיקת תקרת עוסק פטור מסתמכת עליו. " +
        "כדאי לבדוק את החיבור.",
      template_id: "",
      // Keyed on the newest occurrence, so a new failure speaks again and a
      // standing one does not repeat every day.
      dedupe_key: `sync:${newest.occurred_at}`,
    },
  ];
}

/** Urgency first, then recency. Overdue outranks everything. */
const TYPE_RANK: Record<string, number> = {
  overdue: 0,
  deadline: 1,
  recurring: 2,
  sync: 3,
};

function rank(type: string): number {
  return TYPE_RANK[type] ?? 9;
}

/**
 * CONSEQUENCE, INSIDE A TYPE — which this list had no way to see.
 *
 * An expired DOCUMENT emits type "overdue", the top rank, indistinguishable
 * from a missed statutory filing with penalty and interest accruing. The
 * obligations board separates those deliberately — OverdueSection versus
 * LapsedSection, because "a lapsed cover is not an interest-bearing debt" —
 * and this list ranked them as the same thing.
 *
 * The fix reuses the SAME authority for legal weight that the rest of the
 * product uses: legalBasisOf, the registry that already decides which
 * templates may be called critical. Not a second opinion about consequence;
 * there are enough of those in this codebase's history.
 *
 * An item with no template (a document expiry, a sync failure) is advisory by
 * construction: there is no obligation behind it, only the user's own record.
 */
function consequenceRank(templateId: string | null): number {
  if (!templateId) return 1;
  return legalBasisOf(templateId) === "statute" ? 0 : 1;
}

/** Nulls last: an item with no date cannot be nearer than one that has a date. */
function byDate(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Merge what the sweep stored with what is true right now.
 *
 * A draft whose dedupe key is already stored is dropped: the stored row is the
 * same fact, and it carries read state the derived one cannot. Everything else
 * from the engine is added, which is exactly the set the user would have missed.
 */
export function mergeAttention(
  stored: StoredNotification[],
  drafts: NotificationDraft[]
): AttentionItem[] {
  const storedKeys = new Set(
    stored.map((s) => s.dedupe_key).filter((k): k is string => Boolean(k))
  );

  const items: AttentionItem[] = stored.map((s) => ({
    key: s.id,
    type: s.type,
    title: s.title,
    body: s.body,
    templateId: s.template_id,
    dedupeKey: s.dedupe_key,
    // A stored row records no days-left, and reconstructing one from
    // created_at would be a guess. It still ranks by type and by consequence;
    // derived items, current by definition, sort above it.
    daysUntil: null,
    storedId: s.id,
    readAt: s.read_at,
    createdAt: s.created_at,
    derived: false,
  }));

  for (const d of drafts) {
    if (storedKeys.has(d.dedupe_key)) continue;
    items.push({
      key: `live:${d.dedupe_key}`,
      type: d.type,
      title: d.title,
      body: d.body,
      templateId: d.template_id,
      dedupeKey: d.dedupe_key,
      daysUntil: d.days_until,
      storedId: null,
      readAt: null,
      createdAt: null,
      derived: true,
    });
  }

  return items.sort((a, b) => {
    const byType = rank(a.type) - rank(b.type);
    if (byType !== 0) return byType;
    // A statutory filing before advice, inside the same type. This is what
    // stops an expired certificate outranking a missed VAT period.
    const byConsequence = consequenceRank(a.templateId) - consequenceRank(b.templateId);
    if (byConsequence !== 0) return byConsequence;
    /*
     * Then by how near the date is — which this list could not see at all
     * until the draft started carrying it. Within "deadline" the comparator
     * fell straight through to createdAt, and every derived item has a null
     * createdAt, so it returned 0 for every pair: the order was whatever
     * computeReminders happened to emit.
     */
    const byNearness = byDate(a.daysUntil, b.daysUntil);
    if (byNearness !== 0) return byNearness;
    // An unread item outranks a read one of the same urgency.
    const aRead = a.readAt ? 1 : 0;
    const bRead = b.readAt ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    // Derived items have no created_at; they are current by definition, so they
    // sort above stored history of equal urgency.
    if (!a.createdAt && b.createdAt) return -1;
    if (a.createdAt && !b.createdAt) return 1;
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return 0;
  });
}

/**
 * Is the screen entitled to say "nothing needs attention"?
 *
 * Only when the merged list is genuinely empty. The previous check looked at
 * the stored rows alone, which is how an empty table became an all-clear.
 */
export function isGenuinelyCalm(items: AttentionItem[]): boolean {
  return items.length === 0;
}

/** Anything the user has not seen yet, stored or derived. */
export function unreadCount(items: AttentionItem[]): number {
  return items.filter((i) => !i.readAt).length;
}

/** The count of items that are live-only, i.e. nothing was sent for them. */
export function derivedCount(items: AttentionItem[]): number {
  return items.filter((i) => i.derived).length;
}
