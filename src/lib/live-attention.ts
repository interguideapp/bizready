import type { NotificationDraft } from "@/lib/reminders";

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
      storedId: null,
      readAt: null,
      createdAt: null,
      derived: true,
    });
  }

  return items.sort((a, b) => {
    const byType = rank(a.type) - rank(b.type);
    if (byType !== 0) return byType;
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
