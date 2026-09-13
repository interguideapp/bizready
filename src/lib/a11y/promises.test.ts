import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every promise the product makes about its OWN future behaviour.
 *
 * This sweep exists because two separate rounds of fixing produced the same
 * mistake: adding an honest disclosure without finding the older claim it now
 * contradicts. DeliveryNotice went onto the obligations board while the Pro
 * banner two lines below still said "שומר הדדליינים פעיל"; the lapsed-cover
 * section inherited the statutory section's claim that interest was accruing.
 *
 * The product says "נזכיר לכם" in six places. Most are satisfied by the in-app
 * alert, which is derived on every page load and cannot fail — so they are
 * true regardless of the sweep. Two were not:
 *
 *   the obligations board asserted the guard was ACTIVE (fixed: now gated on
 *     delivery being up);
 *   settings promised "נשלח לך סיכום" on the very screen where a person ticks
 *     a box and stops checking, which is the one place the promise costs a
 *     deadline if it is wrong (fixed: says so when sending is down).
 *
 * What this file guards is that neither regresses, since both were invisible
 * until someone went looking for the second statement about one fact.
 */
const root = process.cwd();

/**
 * Source with comments stripped.
 *
 * Needed because these assertions kept matching the explanatory comments that
 * QUOTE the wording being removed — my own note in subscription-block.tsx
 * cites "עובד בשבילכם" to explain why it is gone, and a naive search then
 * reports the phrase as still present. Only what ships to the reader counts.
 */
function stripComments(src: string): string {
  const withoutBlocks = src.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function read(rel: string): string {
  return stripComments(readFileSync(join(root, rel), "utf8"));
}

describe("no surface asserts the reminder pipeline is working while it is not", () => {
  it("the obligations board only claims an active guard when delivery is up", () => {
    expect(read("src/app/(app)/calendar/page.tsx")).toContain(
      "pro && !deliveryIsDown(delivery) &&"
    );
  });

  it("the opt-in screen is told whether sending works", () => {
    // The screen where someone decides to rely on email is the one that most
    // needs to be honest about whether email is going out.
    expect(read("src/app/(app)/settings/page.tsx")).toContain(
      "deliveryDown={deliveryIsDown(await loadDeliveryHealth())}"
    );
    expect(read("src/app/(app)/settings/notification-prefs.tsx")).toContain("{deliveryDown && (");
  });

  it("the subscription card describes what Pro includes, not what is running", () => {
    // "שומר הדדליינים עובד בשבילכם" asserted the sweep was working, from a
    // block that has no way to know.
    const card = read("src/app/(app)/settings/subscription-block.tsx");
    expect(card).toContain("כלול במנוי שלכם");
    expect(card).not.toContain("עובד בשבילכם");
  });
});

describe("the in-app promises stay in-app", () => {
  /**
   * "נעדכן אותך כאן" is true without any scheduler: the notifications page
   * derives its list on load. The word that makes it true is "כאן", so it has
   * to stay.
   */
  it("the calm empty state promises an update HERE, not a message", () => {
    const page = read("src/app/(app)/notifications/page.tsx");
    expect(page).toMatch(/נעדכן אות\S* כאן/);
  });
});

describe("nothing new promises a send without a condition", () => {
  /**
   * A coarse net, and deliberately so: it flags any NEW file that asserts the
   * system will email, push or WhatsApp, so the claim gets looked at rather
   * than shipped unexamined. The known-good list is the point — adding to it
   * should require reading this docstring.
   */
  const ALLOWED = new Set([
    // Says it only when delivery is up.
    "page.tsx",
    // Describes the outage itself.
    "delivery-notice.tsx",
    "sweep-notice.tsx",
    "sweep-health-panel.tsx",
    // Opt-in screen, now carries the caveat.
    "notification-prefs.tsx",
  ]);

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx$/.test(full) ? [full] : [];
    });
  }

  it("only the reviewed surfaces claim an outbound send", () => {
    const claim = /נשלח ל|נשלחות תזכורות|נשלח לך/;
    const offenders = walk(join(root, "src"))
      .filter((f) => !/\.test\.tsx$/.test(f))
      .filter((f) => claim.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.split("\\").join("/").split("/").pop()!)
      .filter((name) => !ALLOWED.has(name));
    expect([...new Set(offenders)]).toEqual([]);
  });
});
