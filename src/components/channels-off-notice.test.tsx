// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChannelsOffNotice } from "./channels-off-notice";

/**
 * ONE FACT, EVERY SURFACE THAT SPEAKS ABOUT IT.
 *
 * "no message can reach you" now has three possible causes and the product has
 * three screens that talk about delivery. Before this component the causes and
 * the screens were mismatched: the obligations board had the opted-out line
 * inline, /insights had nothing, and /notifications showed SweepNotice —
 * whose copy ends "כדאי להיכנס לכאן מדי פעם עד שנוודא שהשליחה האוטומטית
 * עובדת". Sending works; it is switched off. Telling someone we have
 * machinery to verify sends them to wait for a fix that is not coming.
 *
 * That is the shape of every one-truth failure in this codebase: not a wrong
 * fact, but a second surface still saying the old thing.
 */
afterEach(cleanup);

describe("what it says", () => {
  it("names the cause as a setting, not as a failure", () => {
    render(<ChannelsOffNotice />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/התזכורות החוצה כבויות/);
    // Must not imply an outage, a delay, or machinery under repair.
    expect(text).not.toMatch(/לא נשלחו|תקלה|עד שנוודא|לא עובד/);
  });

  it("keeps the screens honest about what IS still true", () => {
    // An honest disclosure that reads as "trust nothing" is its own failure.
    render(<ChannelsOffNotice />);
    expect(document.body.textContent ?? "").toMatch(/מחושב מחדש בכל כניסה/);
  });

  it("offers the switch, since the reader is the one who can fix it", () => {
    render(<ChannelsOffNotice />);
    const link = screen.getByRole("link", { name: /להפעיל תזכורות/ });
    expect(link.getAttribute("href")).toBe("/settings");
  });

  it("says it in one line where the screen's job is something else", () => {
    render(<ChannelsOffNotice compact />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/מעודכן בכל כניסה/);
    expect(text.length).toBeLessThan(160);
  });
});

describe("every surface that reports delivery reports this cause too", () => {
  /**
   * The guard that matters. A fourth screen added later, or one of these three
   * losing the line, is the regression — and it is invisible at runtime
   * because the screen simply says nothing.
   */
  const SURFACES = [
    "src/app/(app)/calendar/page.tsx",
    "src/app/(app)/insights/page.tsx",
    "src/app/(app)/notifications/page.tsx",
  ];

  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it("the premise: each of these already reports a delivery outage", () => {
    // Without this, the list could drift to screens that never spoke about
    // delivery at all and the assertion below would mean nothing.
    for (const rel of SURFACES) {
      expect(read(rel), rel).toContain("DeliveryNotice");
    }
  });

  it("each one also renders the opted-out line", () => {
    for (const rel of SURFACES) {
      expect(read(rel), rel).toContain("ChannelsOffNotice");
      expect(read(rel), rel).toContain('deliveryFault(delivery) === "opted-out"');
    }
  });

  it("none of them keeps a private copy of the markup", () => {
    // It was inline on the board first, which is how the other two came to
    // disagree with it.
    for (const rel of SURFACES) {
      expect(read(rel), rel).not.toContain("התזכורות החוצה כבויות");
    }
  });
});
