import { describe, expect, it } from "vitest";
import {
  attentionHref,
  derivedCount,
  isGenuinelyCalm,
  mergeAttention,
  unreadCount,
  type StoredNotification,
} from "./live-attention";
import type { NotificationDraft } from "./reminders";

function stored(over: Partial<StoredNotification> = {}): StoredNotification {
  return {
    id: "n1",
    type: "deadline",
    title: "stored",
    body: null,
    template_id: "vat-reporting",
    dedupe_key: "deadline:vat-reporting:2026-11-15:7",
    read_at: null,
    created_at: "2026-09-10T06:00:00Z",
    ...over,
  };
}

function draft(over: Partial<NotificationDraft> = {}): NotificationDraft {
  return {
    type: "deadline",
    title: "live",
    body: null,
    template_id: "vat-reporting",
    dedupe_key: "deadline:vat-reporting:2026-11-15:7",
    ...over,
  };
}

/**
 * The point of all of this: the screen must be right when the sweep is not.
 */
describe("a broken sweep can no longer produce an all-clear", () => {
  it("surfaces an overdue filing with nothing stored at all", () => {
    // This is the state a dead cron leaves the database in.
    const items = mergeAttention([], [draft({ type: "overdue", title: "באיחור: מע\"מ" })]);
    expect(items).toHaveLength(1);
    expect(items[0].derived).toBe(true);
    expect(isGenuinelyCalm(items)).toBe(false);
  });

  it("only calls it calm when both sources are empty", () => {
    expect(isGenuinelyCalm(mergeAttention([], []))).toBe(true);
  });

  it("counts a derived item as unread, since nobody has seen it", () => {
    const items = mergeAttention([], [draft()]);
    expect(unreadCount(items)).toBe(1);
    expect(items[0].readAt).toBeNull();
  });
});

describe("merging without duplicating", () => {
  it("drops a draft the sweep already stored", () => {
    // Same fact from two sources. The stored row wins because it carries read
    // state the derived one cannot.
    const items = mergeAttention([stored()], [draft()]);
    expect(items).toHaveLength(1);
    expect(items[0].derived).toBe(false);
    expect(items[0].storedId).toBe("n1");
  });

  it("keeps a draft whose key differs, even for the same task", () => {
    // A new window crossed (14 → 7) is a genuinely new nudge.
    const items = mergeAttention(
      [stored({ dedupe_key: "deadline:vat-reporting:2026-11-15:14" })],
      [draft({ dedupe_key: "deadline:vat-reporting:2026-11-15:7" })]
    );
    expect(items).toHaveLength(2);
  });

  it("does not treat a stored row with no dedupe key as matching everything", () => {
    // A null key must not swallow unrelated drafts.
    const items = mergeAttention([stored({ dedupe_key: null })], [draft()]);
    expect(items).toHaveLength(2);
  });
});

describe("order puts the thing that costs money first", () => {
  it("ranks overdue above an approaching deadline", () => {
    const items = mergeAttention(
      [],
      [
        draft({ type: "deadline", dedupe_key: "a", title: "מתקרב" }),
        draft({ type: "overdue", dedupe_key: "b", title: "באיחור" }),
      ]
    );
    expect(items[0].title).toBe("באיחור");
  });

  it("ranks a recurring notice below a deadline", () => {
    const items = mergeAttention(
      [],
      [
        draft({ type: "recurring", dedupe_key: "a", title: "תקופה חדשה" }),
        draft({ type: "deadline", dedupe_key: "b", title: "מתקרב" }),
      ]
    );
    expect(items.map((i) => i.title)).toEqual(["מתקרב", "תקופה חדשה"]);
  });

  it("puts an unread item above a read one of the same urgency", () => {
    const items = mergeAttention(
      [
        stored({ id: "read", dedupe_key: "a", read_at: "2026-09-11T00:00:00Z" }),
        stored({ id: "unread", dedupe_key: "b", read_at: null }),
      ],
      []
    );
    expect(items[0].storedId).toBe("unread");
  });

  it("sorts stored history newest first", () => {
    const items = mergeAttention(
      [
        stored({ id: "old", dedupe_key: "a", created_at: "2026-09-01T00:00:00Z" }),
        stored({ id: "new", dedupe_key: "b", created_at: "2026-09-10T00:00:00Z" }),
      ],
      []
    );
    expect(items[0].storedId).toBe("new");
  });

  it("puts a live item above stored history of equal urgency", () => {
    // A derived item is true right now; a stored one may be days old.
    const items = mergeAttention(
      [stored({ id: "s", dedupe_key: "a" })],
      [draft({ dedupe_key: "b", title: "live" })]
    );
    expect(items[0].derived).toBe(true);
  });
});

describe("knowing what was actually sent", () => {
  it("reports how many items exist only on screen", () => {
    // These have had no email, push or WhatsApp — the sweep is what sends
    // those, so the UI must not imply otherwise.
    const items = mergeAttention([stored({ dedupe_key: "a" })], [draft({ dedupe_key: "b" })]);
    expect(derivedCount(items)).toBe(1);
  });

  it("reports none when the sweep stored everything", () => {
    expect(derivedCount(mergeAttention([stored()], [draft()]))).toBe(0);
  });
});

/**
 * Where an attention item leads.
 *
 * A document expiry has no task, and the list rendered it as inert markup: the
 * product said "פג תוקף: אישור ניהול ספרים" and gave the reader nowhere to go.
 * An item that names a problem and offers no way to act on it is half a
 * notification.
 */
describe("attentionHref", () => {
  it("sends a task item to its task", () => {
    expect(attentionHref({ templateId: "vat-reporting", dedupeKey: "overdue:vat-reporting:x" })).toBe(
      "/tasks/vat-reporting?from=notifications"
    );
  });

  it("sends a document expiry to the archive", () => {
    expect(attentionHref({ templateId: "", dedupeKey: "doc-expiry:אישור:2026-09-20:7" })).toBe(
      "/documents"
    );
    expect(attentionHref({ templateId: null, dedupeKey: "doc-expired:אישור:2026-06-01" })).toBe(
      "/documents"
    );
  });

  it("works for a STORED document notification, not just a derived one", () => {
    // The stored rows are keyed by database id, so matching on the item key
    // would have covered only derived items — and the stored ones are exactly
    // the notifications the cron already emailed.
    const [item] = mergeAttention(
      [
        {
          id: "row-1",
          type: "overdue",
          title: "פג תוקף: אישור ניהול ספרים",
          body: null,
          template_id: "",
          dedupe_key: "doc-expired:אישור ניהול ספרים:2026-06-01",
          read_at: null,
          created_at: "2026-09-13T00:00:00Z",
        },
      ],
      []
    );
    expect(attentionHref(item)).toBe("/documents");
  });

  it("returns nothing for an item with no destination, rather than /tasks/", () => {
    // An empty template id used to build the href anyway in earlier versions of
    // this list; "/tasks/" is not a page.
    expect(attentionHref({ templateId: "", dedupeKey: "sync:icount:2026-09-13" })).toBeNull();
  });
});
