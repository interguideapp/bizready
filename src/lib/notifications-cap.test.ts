import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/data";

/**
 * The alerts list is capped, and the cap is why the ORDER matters.
 *
 * getNotifications used to take the fifty most RECENT rows and say nothing
 * about the rest. So an overdue notification from two months ago — still
 * unread, still unaddressed — was dropped to make room for fifty recent
 * deadline nudges. mergeAttention sorts by urgency, but it can only sort what
 * it was handed, and the cap had already thrown the urgent one away. On the one
 * screen whose entire job is that nothing gets missed.
 *
 * These assertions read the query, because the guarantee lives in the ordering
 * and there is no way to express it in a pure unit.
 */
const src = readFileSync(join(process.cwd(), "src/lib/data.ts"), "utf8");
const query = src.slice(
  src.indexOf("export async function getNotifications"),
  src.indexOf("export interface OfferRow")
);

describe("an unread alert can never be the row that is cut", () => {
  it("orders unread before read", () => {
    expect(query).toContain('order("read_at", { ascending: true, nullsFirst: true })');
  });

  it("orders by recency only after that", () => {
    // Within unread, and within read, newest first — but never ahead of the
    // unread/read split, which is the property that protects the warning.
    const readAtAt = query.indexOf('order("read_at"');
    const createdAt = query.indexOf('order("created_at"');
    expect(readAtAt).toBeGreaterThan(-1);
    expect(createdAt).toBeGreaterThan(readAtAt);
  });

  it("fetches one more than it shows, so truncation is detectable", () => {
    // The same trick getDocuments uses. Without it there is no way to tell
    // "exactly fifty" from "fifty of two hundred", and the page has to either
    // lie or stay silent.
    expect(query).toContain("limit(limit + 1)");
  });

  it("does not silently keep the old recency-only cap", () => {
    expect(query).not.toContain(".limit(50)");
  });
});

describe("the page says when it left rows out", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(app)/notifications/page.tsx"),
    "utf8"
  );

  it("renders a notice when the list was truncated", () => {
    expect(page).toContain("truncated &&");
  });

  it("gives the unread reassurance only when it is actually true", () => {
    /*
     * THIS ASSERTED THE REASSURANCE UNCONDITIONALLY, and called it "the one
     * that is true". It is true only while the unread rows FIT.
     *
     * The ordering guarantees a read row is cut before an unread one, which is
     * what this guard was written for. Past the page size the cut lands inside
     * the unread block, and "כל מה שלא נקרא מופיע כאן" is then false —
     * precisely when the list is at its most overwhelming.
     *
     * So the reassurance must be behind the condition, and the other branch
     * must exist. Details in lib/unread-truncation.test.ts.
     */
    expect(page).toContain("unreadTruncated ? (");
    expect(page.replace(new RegExp("\\s+", "g"), " ")).toContain("כל מה שלא נקרא מופיע כאן");
    expect(page.replace(new RegExp("\\s+", "g"), " ")).toMatch(/התראות שלא נקראו/);
  });

  it("uses the shared page size rather than a second hardcoded number", () => {
    expect(page).toContain("NOTIFICATIONS_PAGE_SIZE");
    expect(NOTIFICATIONS_PAGE_SIZE).toBeGreaterThan(0);
  });
});
