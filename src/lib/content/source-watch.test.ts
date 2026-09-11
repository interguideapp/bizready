import { describe, expect, it } from "vitest";
import {
  CHANGE_TOLERANCE,
  changeNotice,
  compareSource,
  fingerprint,
  normaliseSource,
  type SourceFingerprint,
} from "./source-watch";

/**
 * The whole risk with a source watcher is crying wolf. A gov.il page carries a
 * session token, a build id, a rotating banner and a "last visited" stamp — so a
 * naive hash changes on every fetch, the alerts become noise, and a muted
 * watcher detects nothing at all.
 *
 * These tests are mostly about NOT firing.
 */

const page = (body: string) =>
  `<!doctype html><html><head><title>רשות המסים</title>
   <script>window.__BUILD_ID="a1b2c3d4e5f6";</script>
   <style>.x{color:#fff}</style>
   <!-- rendered 2026-09-11T10:21:33Z -->
   </head><body><div class="wrapper">${body}</div>
   <span class="visits">1284391 צפיות</span>
   <footer>עודכן לאחרונה: 11/09/2026</footer></body></html>`;

const CONTENT = "תקרת עוסק פטור לשנת המס היא 122,833 שקלים. הדיווח עד ה-15 בחודש.";

function baselineFor(html: string): SourceFingerprint {
  const fp = fingerprint(html);
  return { url: "https://www.gov.il/x", ...fp, checkedAt: "2026-09-01" };
}

describe("normalisation removes what changes on its own", () => {
  it("strips scripts, styles, comments and tags", () => {
    const text = normaliseSource(page(CONTENT));
    expect(text).not.toContain("script");
    expect(text).not.toContain("__build_id");
    expect(text).not.toContain("color:#fff");
    expect(text).not.toContain("<div");
  });

  it("strips dates, so a 'last updated' stamp is not a change", () => {
    const text = normaliseSource(page(CONTENT));
    expect(text).not.toContain("11/09/2026");
    expect(text).not.toContain("2026-09-11");
  });

  it("strips long digit runs like session ids and view counters", () => {
    expect(normaliseSource(page(CONTENT))).not.toContain("1284391");
  });

  it("KEEPS the short numbers that are the actual content", () => {
    // 15 is a filing deadline and 122,833 is the ceiling. A watcher that
    // scrubbed those would be blind to the changes that matter most.
    const text = normaliseSource(page(CONTENT));
    expect(text).toContain("15");
    expect(text).toContain("122,833");
  });

  it("keeps the prose itself", () => {
    expect(normaliseSource(page(CONTENT))).toContain("תקרת עוסק פטור");
  });
});

describe("compareSource does not cry wolf", () => {
  it("reports a baseline on first sight, and raises nothing", () => {
    const verdict = compareSource(page(CONTENT), null);
    expect(verdict.status).toBe("baseline");
    expect(changeNotice("https://x", verdict)).toBeNull();
  });

  it("is unchanged when only the build id, dates and counters moved", () => {
    // This is the case that decides whether the watcher is usable at all: the
    // same page fetched twice, with every volatile element different.
    const before = baselineFor(page(CONTENT));
    const after = `<!doctype html><html><head><title>רשות המסים</title>
      <script>window.__BUILD_ID="99887766zzzz";</script>
      <style>.x{color:#000}</style>
      <!-- rendered 2027-01-02T23:59:01Z -->
      </head><body><div class="different-class">${CONTENT}</div>
      <span class="visits">9999999 צפיות</span>
      <footer>עודכן לאחרונה: 02/01/2027</footer></body></html>`;
    expect(compareSource(after, before).status).toBe("unchanged");
  });

  it("is unchanged when the markup is restructured but the words are identical", () => {
    // A redesign that keeps the same copy: different tags, different classes,
    // different nesting, same words. This must not fire.
    const before = baselineFor(page(CONTENT));
    const after = `<!doctype html><html><head><title>רשות המסים</title></head>
      <body><section><article role="main"><p class="lede">${CONTENT}</p></article>
      <aside><span>1284391 צפיות</span></aside>
      <footer><time>עודכן לאחרונה: 11/09/2026</time></footer></section></body></html>`;
    expect(compareSource(after, before).status).toBe("unchanged");
  });

  it("absorbs a tiny wobble below the tolerance", () => {
    const long = CONTENT.repeat(40);
    const before = baselineFor(page(long));
    // A handful of characters against a few thousand.
    expect(compareSource(page(long + " ו."), before).status).toBe("unchanged");
    expect(CHANGE_TOLERANCE).toBeGreaterThan(0);
  });

  it("DOES fire when the substance changes", () => {
    const before = baselineFor(page(CONTENT));
    const after = page(
      "תקרת עוסק פטור לשנת המס היא 126,000 שקלים. הדיווח עד ה-15 בחודש. " +
        "נוסף סעיף חדש: חובת דיווח מקוון לכל העוסקים, כולל פטורים, מתחילת השנה."
    );
    const verdict = compareSource(after, before);
    expect(verdict.status).toBe("changed");
    if (verdict.status === "changed") {
      expect(verdict.previousChecksum).toBe(before.checksum);
      expect(verdict.lengthDelta).not.toBe(0);
    }
  });

  it("says LOOK, never 'the law changed'", () => {
    // A checksum cannot tell a redrafted regulation from a reorganised web
    // page. Overclaiming here would undo the credibility the rest of this work
    // was for.
    const before = baselineFor(page(CONTENT));
    const verdict = compareSource(page(CONTENT + " " + CONTENT), before);
    const notice = changeNotice("https://www.gov.il/x", verdict)!;
    expect(notice).toContain("לא אומר שהחוק השתנה");
    expect(notice).toContain("צריך לקרוא ולאשר");
  });
});

describe("an unreadable page is never reported as unchanged", () => {
  it("reports unavailable for a page with no readable text", () => {
    // A redirect, a login wall or an error page normalises to nothing.
    // "Unchanged" here would silently confirm content we never read — the same
    // reassuring-in-the-wrong-direction failure this codebase has been fixing.
    for (const empty of ["", "<script>x()</script>", "<!-- nothing -->", "<div></div>"]) {
      const verdict = compareSource(empty, baselineFor(page(CONTENT)));
      expect(verdict.status, JSON.stringify(empty)).toBe("unavailable");
    }
  });

  it("and tells the reviewer to check by hand", () => {
    const verdict = compareSource("", baselineFor(page(CONTENT)));
    expect(changeNotice("https://www.gov.il/x", verdict)).toContain("בדקו ידנית");
  });
});

describe("fingerprint", () => {
  it("is stable for identical input", () => {
    expect(fingerprint(page(CONTENT)).checksum).toBe(fingerprint(page(CONTENT)).checksum);
  });

  it("differs for different content", () => {
    expect(fingerprint(page(CONTENT)).checksum).not.toBe(
      fingerprint(page(CONTENT + " נוסף")).checksum
    );
  });
});
