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
  /**
   * Full paths, not basenames.
   *
   * This list used to contain the bare basename "page.tsx", and there are 21
   * page.tsx files in the app — so every single route was exempt and the net
   * could only ever catch a claim inside a non-page component. The claim this
   * whole file exists because of, the obligations board asserting the guard
   * was active, lives on a page.tsx.
   *
   * Checked before narrowing: no page carries a send claim today, so the
   * blanket entry was protecting nothing and hiding everything.
   */
  const ALLOWED = new Set([
    // Describes the outage itself.
    "src/components/delivery-notice.tsx",
    "src/app/(app)/notifications/sweep-notice.tsx",
    "src/components/admin/sweep-health-panel.tsx",
    // Opt-in screen, now carries the caveat.
    "src/app/(app)/settings/notification-prefs.tsx",
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
      .map((f) => f.slice(root.length + 1).split("\\").join("/"))
      .filter((rel) => !ALLOWED.has(rel));
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe("nothing new promises a reminder without being able to keep it", () => {
  /**
   * "נזכיר" — the product's main promise word, and the one this file's own
   * docstring admits the net above leaves out.
   *
   * Leaving it out was defensible: most of these are kept by the in-app alert,
   * which is derived on every page load and cannot fail, so they are true
   * whether or not the sweep runs. But "defensible for the six that exist" is
   * not the same as "safe for the seventh", and the seventh is exactly what a
   * coarse net is for.
   *
   * Every entry below was read and checked to be satisfiable in-app:
   *
   *   document-row      an expiry date the user just set — doc-expiry drafts
   *   wizard            the plan's filing dates — deadline drafts
   *   deadline-picker   a personal target — personal_due_date is in the engine
   *   milestone-tracker a follow-up date — followup drafts
   *   next-cycle        the next reporting period — recurring drafts
   *   calendar          the ESCALATING windows, which are outbound and so are
   *                     gated on !deliveryIsDown — asserted separately above
   *
   * notification-prefs is deliberately NOT on the list: its only "נזכיר" is
   * inside a comment, and the staleness assertion below caught me adding it
   * anyway — an allowlist entry for a file that does not make the claim is an
   * exemption sitting ready to hide the next one.
   *
   * Adding to this list should mean answering, for the new surface: can this
   * promise be kept with the scheduler dead?
   */
  const ALLOWED_REMINDS = new Set([
    "src/app/(app)/documents/document-row.tsx",
    "src/app/onboarding/wizard.tsx",
    "src/components/task/deadline-picker.tsx",
    "src/components/task/milestone-tracker.tsx",
    "src/components/task/next-cycle.tsx",
    "src/app/(app)/calendar/page.tsx",
  ]);

  function walkTsx(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walkTsx(full);
      return /\.tsx$/.test(full) ? [full] : [];
    });
  }

  it("only reviewed surfaces promise to remind", () => {
    const offenders = walkTsx(join(root, "src"))
      .filter((f) => !/\.test\.tsx$/.test(f))
      .filter((f) => /נזכיר/.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(root.length + 1).split("\\").join("/"))
      .filter((rel) => !ALLOWED_REMINDS.has(rel));
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("the list is not stale, so it cannot pass by listing everything", () => {
    // An allowlist entry for a file that no longer makes the claim is an
    // exemption waiting to hide the next one.
    const stale = [...ALLOWED_REMINDS].filter(
      (rel) => !/נזכיר/.test(stripComments(readFileSync(join(root, rel), "utf8")))
    );
    expect(stale).toEqual([]);
  });
});
