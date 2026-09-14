import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeProfileCompleteness } from "@/lib/profile-score";
import type { BusinessRow } from "@/lib/data";

/**
 * "מה חסר ל-100%?" PROMISED A LINK AND SEVEN OF TEN WENT NOWHERE.
 *
 * The card lists what is missing from the business profile and says, under the
 * list: "לחיצה על פריט חסר תיקח אתכם ישר למקום שבו משלימים אותו". Seven of the
 * ten items pointed at "/business" — the page the card itself is on. Clicking
 * them navigated to the URL already in the address bar, so nothing happened.
 *
 * Reported by the user, who saw it at once: "כשלוחצים על רובם לא נפתח כלום".
 * The three that worked were the three pointing somewhere else.
 *
 * Every item now addresses the field that completes it, and business-card.tsx
 * reads the hash to open edit mode with that input focused — an anchor alone
 * would land you on a read-only row and the promise still would not be kept.
 */
const root = process.cwd();

function business(over: Partial<BusinessRow> = {}): BusinessRow {
  return {
    id: "b1",
    name: "",
    dealer_number: null,
    vat_file: null,
    income_tax_file: null,
    bituach_leumi_file: null,
    bank_name: null,
    bank_account: null,
    accountant_name: null,
    accountant_phone: null,
    logo_path: null,
    ...over,
  } as BusinessRow;
}

const CARD = readFileSync(
  join(root, "src/app/(app)/business/business-card.tsx"),
  "utf8"
);

describe("no item links to the page it is already on", () => {
  const checks = computeProfileCompleteness(business(), {
    products: 0,
    documents: 0,
  }).checks;

  it("the premise: every check is missing, so every href is exercised", () => {
    expect(checks.length).toBeGreaterThan(5);
    expect(checks.every((c) => !c.done)).toBe(true);
  });

  it("nothing points at bare /business", () => {
    // The defect, stated as the thing that must never come back.
    const dead = checks.filter((c) => c.href === "/business").map((c) => c.id);
    expect(dead).toEqual([]);
  });

  it("every href either leaves the page or addresses a field on it", () => {
    for (const c of checks) {
      const addressesAField = c.href.startsWith("/business#field-");
      const leavesThePage = !c.href.startsWith("/business");
      expect(addressesAField || leavesThePage, `${c.id} -> ${c.href}`).toBe(true);
    }
  });
});

describe("every field anchor exists in the card", () => {
  /**
   * A link to #field-x is worth nothing if no element carries that id. This is
   * the half a URL check alone cannot see, and it is how the original defect
   * would have come back in a subtler form.
   */
  const checks = computeProfileCompleteness(business(), {
    products: 0,
    documents: 0,
  }).checks;

  it("the card renders an id for each one linked to", () => {
    const anchored = checks
      .filter((c) => c.href.includes("#field-"))
      .map((c) => c.href.split("#field-")[1]);
    expect(anchored.length).toBeGreaterThan(0);
    for (const key of anchored) {
      // FIELD_KEYS is typed against EditableFields, so a key present there is
      // a real column and a real row.
      expect(CARD, key).toContain(key + ": true");
    }
  });

  it("the rows carry the id in both read and edit mode", () => {
    // Read mode is the default, so an anchor only on the edit rendering would
    // fail for exactly the person arriving from the link.
    expect(CARD.match(/id=\{"field-" \+ fieldKey\}/g)?.length).toBe(2);
  });

  it("and scroll-margin, so the row is not hidden under the header", () => {
    expect(CARD).toContain("scroll-mt-28");
  });
});

describe("the link opens edit mode rather than just scrolling", () => {
  it("reacts to a hash change, not only to mount", () => {
    // Clicking one of these while already on /business changes only the hash.
    // React does not remount, so a mount-only effect would work once and then
    // never again — which is indistinguishable from the original bug.
    expect(CARD).toContain('window.addEventListener("hashchange"');
    expect(CARD).toContain('window.removeEventListener("hashchange"');
  });

  it("focuses the input it scrolled to", () => {
    expect(CARD).toContain('querySelector("input")?.focus()');
  });

  it("does not offer edit mode to a collaborator", () => {
    // The database has no accountant write policy on businesses, so opening
    // edit mode for them would be offering a save that must fail.
    expect(CARD).toContain("if (!canEdit) return;");
  });
});
