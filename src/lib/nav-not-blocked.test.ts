import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY NAVIGATION WAITED ON ONE DIGIT.
 *
 * The (app) layout awaited loadAttentionCount before returning any markup.
 * That call is five Supabase queries plus a reminders computation over every
 * task, and it decides the number on the notifications icon — nothing else.
 * The layout wraps every authenticated page, so every navigation in the
 * product paid it before anything rendered.
 *
 * The user reported it as "מעבר בין דפים איטי". Two causes, both invisible in
 * the code itself:
 *
 *   the badge blocking the layout, fixed here;
 *   and the functions running in iad1 while the database sits in
 *   eu-central-1, so each of those queries was a transatlantic round trip —
 *   pinned in cron/vercel-config.test.ts.
 *
 * The count itself is unchanged and still derived rather than read from the
 * notifications table: a sweep that had stopped running used to show a badge
 * of zero with a statutory filing overdue, and no badge means no reason to
 * open the page that would have said so.
 */
const root = process.cwd();

function shipped(rel: string): string {
  const source = readFileSync(join(root, rel), "utf8");
  let out = source;
  for (;;) {
    const open = out.indexOf("/" + "*");
    if (open === -1) break;
    const close = out.indexOf("*" + "/", open + 2);
    if (close === -1) break;
    out = out.slice(0, open) + " " + out.slice(close + 2);
  }
  return out
    .split(String.fromCharCode(10))
    .filter((line) => !line.trim().startsWith("//"))
    .join(String.fromCharCode(10));
}

const LAYOUT = shipped("src/app/(app)/layout.tsx");

describe("the layout does not block on the badge", () => {
  it("never awaits the attention count", () => {
    // The single line that made every navigation slow.
    expect(LAYOUT).not.toContain("await loadAttentionCount");
    expect(LAYOUT).not.toContain("loadAttentionCount");
  });

  it("renders the badge behind a Suspense boundary", () => {
    // Without the boundary the async component blocks the layout again and the
    // fix is undone while still looking refactored.
    expect(LAYOUT).toContain("<Suspense fallback={null}>");
    expect(LAYOUT).toContain("<AttentionBadge />");
  });

  it("the boundary wraps the badge, not the page content", () => {
    /*
     * The first version of this compared {children} against the FIRST
     * "</Suspense>" -- so wrapping children in a boundary of their own passed,
     * because the badge's closing tag still came earlier. Planting exactly
     * that is how I found out.
     *
     * There is one boundary in this layout and it is the badge's. Counting is
     * what makes "children are outside it" actually checkable: a second
     * boundary would mean something else is being streamed, and around
     * {children} that means the page is waiting again.
     */
    const opens = LAYOUT.match(/<Suspense/g) ?? [];
    const closes = LAYOUT.split(String.fromCharCode(60) + "/Suspense>").length - 1;
    expect(opens, "exactly one Suspense boundary belongs in this layout").toHaveLength(1);
    expect(closes).toBe(1);

    const badgeAt = LAYOUT.indexOf("<AttentionBadge");
    const childrenAt = LAYOUT.indexOf("{children}");
    expect(badgeAt).toBeGreaterThan(LAYOUT.indexOf("<Suspense"));
    expect(badgeAt).toBeLessThan(LAYOUT.indexOf("</Suspense>"));
    // And the page content sits after the boundary closes.
    expect(childrenAt).toBeGreaterThan(LAYOUT.indexOf("</Suspense>"));
  });

  it("still awaits the business, because the redirect depends on it", () => {
    // Not everything can stream: an unonboarded visitor must be redirected
    // before any shell renders, so this await is load-bearing and stays.
    expect(LAYOUT).toContain("await getBusiness()");
    expect(LAYOUT).toContain('redirect("/onboarding")');
  });
});

describe("the badge component owns the count", () => {
  const BADGE = shipped("src/components/attention-badge.tsx");

  it("derives the count rather than reading a stored number", () => {
    // The reason the layout computed it in the first place, preserved.
    expect(BADGE).toContain("loadAttentionCount");
  });

  it("renders nothing when there is nothing to report", () => {
    // A zero badge is visual noise, and an empty node is what lets the
    // Suspense fallback be null without a layout shift.
    expect(BADGE).toContain("if (unread <= 0) return null;");
  });

  it("survives having no business without throwing", () => {
    // It runs inside a boundary; an exception here would blank the badge for
    // everyone rather than only for the case that caused it.
    expect(BADGE).toContain("if (!business) return null;");
  });
});
