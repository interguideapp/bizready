// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/actions", () => ({ cancelPro: vi.fn() }));
const { SubscriptionBlock } = await import("@/app/(app)/settings/subscription-block");
const { SubscriptionLapsed } = await import("./subscription-lapsed");

/**
 * What the product says about its own billing period.
 *
 * Two things were wrong and both were the product failing its own standard. It
 * called every period a TRIAL — subscription_until is the current billing
 * period end for paid subscriptions too — so a paying monthly subscriber read
 * that their trial expired in a month. And it never warned before the period
 * ended, in a product whose whole promise is warning before a deadline, about
 * the one deadline that decides whether the other warnings keep arriving.
 */
afterEach(cleanup);

describe("the active subscription block", () => {
  it("does not call a paid billing period a trial", () => {
    render(<SubscriptionBlock until="2026-10-13T00:00:00Z" state="active" daysLeft={30} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/הניסיון/);
    expect(text).toMatch(/התקופה הנוכחית בתוקף עד/);
  });

  it("stays quiet when the period is far off", () => {
    render(<SubscriptionBlock until="2026-12-01T00:00:00Z" state="active" daysLeft={79} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns as the period end approaches, naming the consequence", () => {
    render(<SubscriptionBlock until="2026-09-16T00:00:00Z" state="ending_soon" daysLeft={3} />);
    const notice = screen.getByRole("status").textContent ?? "";
    // The distance, in the same vocabulary the obligations board uses.
    expect(notice).toMatch(/בעוד 3 ימים/);
    // And what actually changes, rather than "you will lose features".
    expect(notice).toMatch(/תזכורות|המסלול החינמי|המסלול/);
  });
});

describe("the lapsed notice", () => {
  it("says the subscription ended rather than selling an upgrade", () => {
    render(<SubscriptionLapsed untilIso="2026-09-01T00:00:00Z" daysAgo={12} />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/המנוי הסתיים/);
    // The likeliest cause, said plainly, because it is the fixable one.
    expect(text).toMatch(/חיוב שלא עבר/);
  });

  it("states what narrowed, and that the deadlines themselves remain", () => {
    render(<SubscriptionLapsed untilIso="2026-09-01T00:00:00Z" daysAgo={12} />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/פחות התראות/);
    // Important: a lapse must not read as "the product stopped working".
    expect(text).toMatch(/ממשיכים להופיע כרגיל/);
  });

  it("offers the way back", () => {
    render(<SubscriptionLapsed untilIso="2026-09-01T00:00:00Z" daysAgo={12} />);
    expect(screen.getByRole("link", { name: /חידוש המנוי/ })).toBeDefined();
  });
});

describe("the settings screen actually reaches these states", () => {
  /**
   * Asserted against the source, because deleting the wiring typechecks and
   * leaves every test above green — the components would still be correct and
   * nothing would render them. That has happened twice in this codebase
   * already: syncErrorDrafts and, earlier today, a renewal rule added as an
   * optional field that all five callers omitted.
   */
  it("renders the lapsed notice before falling through to the upgrade pitch", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
    expect(page).toContain('standing.state === "lapsed"');
    expect(page).toContain("<SubscriptionLapsed");
    // Order matters: a lapsed row is not isPro, so an isPro-first branch would
    // send it to UpgradeCta and the notice would never show.
    expect(page.indexOf("standing.state ===")).toBeLessThan(page.indexOf("isPro(business)"));
  });

  it("passes the standing into the active block rather than recomputing it", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
    expect(page).toContain("state={standing.state}");
    expect(page).toContain("daysLeft={standing.daysLeft}");
  });
});
