// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions", () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
const { NotificationList } = await import("./notification-list");
import type { AttentionItem } from "@/lib/live-attention";

/**
 * The badge that will not go down.
 *
 * unreadCount counts anything without a read timestamp, and a DERIVED item
 * never has one — there is no stored row to write it to. So pressing
 * "סימון הכל כנקרא" clears the stored rows, removes the button, and leaves the
 * dock still showing a number. From the user's side that is a button that did
 * nothing.
 *
 * The count is deliberately left alone. A badge that goes quiet while a filing
 * is overdue is the exact failure this product exists to prevent, and clearing
 * on read would suppress the most important alert it can raise. The number was
 * right; the explanation was missing.
 */
afterEach(cleanup);

function item(over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    key: "k1",
    type: "deadline",
    title: "דיווח מע״מ",
    body: null,
    templateId: "vat-reporting",
    dedupeKey: "deadline:vat-reporting:2026-09-15:30",
    daysUntil: 30,
    storedId: null,
    readAt: null,
    createdAt: null,
    derived: true,
    ...over,
  };
}

const storedUnread = item({
  key: "s1",
  storedId: "s1",
  derived: false,
  createdAt: "2026-09-13T04:00:00Z",
  dedupeKey: "overdue:vat-reporting:2026-07-15",
});

describe("when nothing more can be marked read", () => {
  it("explains why the badge still shows a number", () => {
    render(<NotificationList items={[item()]} />);
    expect(document.body.textContent ?? "").toMatch(/ממשיך להיספר בתג/);
  });

  it("uses the singular for one item", () => {
    // The recurring Hebrew defect in this codebase is a numeral 1 beside a
    // plural noun.
    const text = () => document.body.textContent ?? "";
    render(<NotificationList items={[item()]} />);
    expect(text()).toMatch(/פריט אחד/);
    expect(text()).not.toMatch(/1 פריטים/);
  });

  it("uses the plural for several", () => {
    render(<NotificationList items={[item(), item({ key: "k2" })]} />);
    expect(document.body.textContent ?? "").toMatch(/2 פריטים/);
  });

  it("says they clear themselves, so it does not read as a dead end", () => {
    render(<NotificationList items={[item()]} />);
    expect(document.body.textContent ?? "").toMatch(/ייעלם/);
  });
});

describe("when there IS something to mark read", () => {
  it("offers the bulk action instead of the explanation", () => {
    // Both at once would be noise: the button is the thing to do next.
    render(<NotificationList items={[storedUnread, item()]} />);
    expect(screen.getByRole("button", { name: /סימון הכל כנקרא/ })).toBeDefined();
    expect(document.body.textContent ?? "").not.toMatch(/ממשיך להיספר בתג/);
  });

  it("does not offer the bulk action when every stored row is already read", () => {
    const read = item({ key: "s2", storedId: "s2", derived: false, readAt: "2026-09-13T05:00:00Z" });
    render(<NotificationList items={[read]} />);
    expect(screen.queryByRole("button", { name: /סימון הכל כנקרא/ })).toBeNull();
  });

  it("says nothing at all when there are no derived items left", () => {
    const read = item({ key: "s3", storedId: "s3", derived: false, readAt: "2026-09-13T05:00:00Z" });
    render(<NotificationList items={[read]} />);
    expect(document.body.textContent ?? "").not.toMatch(/ממשיך להיספר בתג/);
  });
});
