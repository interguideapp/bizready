import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/data";

/**
 * "כל מה שלא נקרא מופיע כאן" WAS AN UNCONDITIONAL PROMISE.
 *
 * getNotifications caps the list and orders unread first, so a READ row is
 * always cut before an unread one — that part is sound and was built
 * deliberately, after an unread overdue notification from two months ago was
 * dropped to make room for fifty recent nudges.
 *
 * What it does not guarantee is that every unread row FITS. Past the page size
 * the cut lands inside the unread block, and the page asserted the opposite in
 * so many words. False exactly when the list is at its most overwhelming, on
 * the screen whose whole job is that nothing gets missed — and the page's own
 * docstring says "truncating an alerts list in silence is the same defect as
 * an obligations board that shows eight rows and does not mention the ninth".
 *
 * The ordering guarantee is what makes the detection cheap: if every row we
 * kept is unread and there was at least one more, the next one is unread too.
 */
const row = (readAt: string | null) => ({ read_at: readAt });

/** The derivation as loadAttentionPage performs it. */
function unreadTruncatedFrom(raw: { read_at: string | null }[]): boolean {
  const truncated = raw.length > NOTIFICATIONS_PAGE_SIZE;
  const stored = truncated ? raw.slice(0, NOTIFICATIONS_PAGE_SIZE) : raw;
  return truncated && stored.every((s) => !s.read_at);
}

/** `n` unread rows, then `m` read ones — the order the query returns. */
const page = (unread: number, read: number) => [
  ...Array.from({ length: unread }, () => row(null)),
  ...Array.from({ length: read }, () => row("2026-09-01T00:00:00Z")),
];

describe("when the cut reaches the unread rows", () => {
  it("reports it once there are more unread than fit", () => {
    expect(unreadTruncatedFrom(page(NOTIFICATIONS_PAGE_SIZE + 1, 0))).toBe(true);
  });

  it("reports it however many read rows trail behind", () => {
    expect(unreadTruncatedFrom(page(NOTIFICATIONS_PAGE_SIZE + 5, 20))).toBe(true);
  });
});

describe("when only read history was dropped", () => {
  it("stays quiet with exactly a full page of unread and nothing more", () => {
    // Not truncated at all: the extra row the query fetches is what detects
    // "more than the limit", and there isn't one.
    expect(unreadTruncatedFrom(page(NOTIFICATIONS_PAGE_SIZE, 0))).toBe(false);
  });

  it("stays quiet when the cut falls in the read block", () => {
    // The common case, and the one the original sentence was written for.
    expect(unreadTruncatedFrom(page(3, NOTIFICATIONS_PAGE_SIZE))).toBe(false);
  });

  it("stays quiet when the page is not full", () => {
    expect(unreadTruncatedFrom(page(2, 2))).toBe(false);
  });

  it("stays quiet for an empty list", () => {
    expect(unreadTruncatedFrom([])).toBe(false);
  });
});

describe("the premise the detection rests on", () => {
  it("the query really does order unread before read", () => {
    /*
     * Without this the derivation is unfounded: "every kept row is unread"
     * only implies "the next one is unread" because of the ordering. Asserted
     * at the source, since no runtime observation here reaches Postgres.
     */
    const data = readFileSync(join(process.cwd(), "src/lib/data.ts"), "utf8");
    const at = data.indexOf("export async function getNotifications");
    expect(at).toBeGreaterThan(-1);
    const body = data.slice(at, data.indexOf("\n}", at));
    expect(body).toContain('order("read_at", { ascending: true, nullsFirst: true })');
    // And one extra row, or "more than the limit" cannot be distinguished
    // from "exactly the limit".
    expect(body).toContain("limit(limit + 1)");
  });
});

describe("production derives the flag the same way", () => {
  /**
   * THE BLIND SPOT IN EVERY CASE ABOVE, found by planting the bug.
   *
   * They exercise a local copy of the derivation, so they prove the LOGIC and
   * say nothing about whether loadAttentionPage uses it. I hardcoded the flag
   * to false in attention.ts and all eight passed — the same failure that let
   * a sign inversion through the alerts-ordering tests earlier.
   *
   * loadAttentionPage needs a Supabase session, so the check is at the source:
   * the shape has to be the one reasoned about here, and not a constant.
   */
  const attention = readFileSync(join(process.cwd(), "src/lib/attention.ts"), "utf8");

  it("reads it off the rows it kept, not from a literal", () => {
    expect(attention).toContain("truncated && stored.every((s) => !s.read_at)");
  });

  it("returns it to the caller", () => {
    expect(attention).toContain("unreadTruncated,");
  });
});

describe("the page says which of the two it is", () => {
  it("renders the honest sentence in each case", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(app)/notifications/page.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(src).toContain("unreadTruncated ? (");
    // The unconditional claim must no longer stand alone.
    expect(src).toContain("שלא נקרא מופיע כאן");
    expect(src).toMatch(/התראות שלא נקראו/);
  });
});
