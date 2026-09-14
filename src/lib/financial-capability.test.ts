import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capabilitiesFor, type EffectiveRole } from "@/lib/members";

/**
 * THE UI MAY NOT OFFER WHAT THE DATABASE REFUSES.
 *
 * /insights had no role check anywhere on it, while the obligations board
 * gates its one mutating control. business_costs and sync_metrics grant writes
 * to the business OWNER, with members holding SELECT alone — verified against
 * the live policies, not assumed — so an accountant saw the income logger and
 * the cost manager and could use neither.
 *
 * Pressing save was the worse half. requireBusinessId looks the business up by
 * owner_id, finds none for a collaborator, and redirected them to
 * /onboarding — dropping an accountant into a twelve-question wizard about a
 * business that is not theirs. getBusinessContext's docstring names exactly
 * that outcome as the thing to avoid ("inviting an accountant and then asking
 * them to answer twelve questions about a business that is not theirs would be
 * absurd"), and this path did it anyway.
 *
 * completeTasks could not be reused as the gate: an accountant HAS it, by
 * design, because filing is what they are there for. The money ledger is a
 * different thing.
 */
const ROLES: EffectiveRole[] = ["owner", "accountant", "viewer"];

describe("only the owner may rewrite the books", () => {
  it("gives the owner the capability", () => {
    expect(capabilitiesFor("owner").editFinancials).toBe(true);
  });

  it("withholds it from an accountant, who can still complete tasks", () => {
    // The pair that matters: the accountant keeps what they are there for and
    // does not get what the database will refuse.
    const acc = capabilitiesFor("accountant");
    expect(acc.editFinancials).toBe(false);
    expect(acc.completeTasks).toBe(true);
  });

  it("withholds it from a viewer", () => {
    expect(capabilitiesFor("viewer").editFinancials).toBe(false);
  });

  it("is decided for every role, so a new role cannot default to allowed", () => {
    for (const role of ROLES) {
      expect(typeof capabilitiesFor(role).editFinancials, role).toBe("boolean");
    }
  });

  it("matches ownership exactly, which is what the policies enforce", () => {
    // If these ever diverge, the UI is offering something RLS will reject.
    for (const role of ROLES) {
      expect(capabilitiesFor(role).editFinancials, role).toBe(role === "owner");
    }
  });
});

describe("the page and the action both apply it", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it("insights resolves the reader's role at all", () => {
    // It called requireBusiness(), which returns no role — so there was
    // nothing on the page that could have gated anything.
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).toContain("requireBusinessContext()");
    expect(page).toContain("capabilitiesFor(role).editFinancials");
  });

  it("hides the income logger from a reader who cannot save", () => {
    expect(read("src/app/(app)/insights/page.tsx")).toContain("canEditFinancials && (");
  });

  it("keeps the cost figures visible while removing the controls", () => {
    // An accountant came to read the net line; the fixed-cost total feeds it.
    // Hiding the panel would answer the wrong problem.
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).toContain("canEdit={canEditFinancials}");
    expect(read("src/components/costs-manager.tsx")).toContain("canEdit && (");
  });

  it("refuses a collaborator instead of sending them to onboarding", () => {
    // The absurd outcome, asserted at the source: no runtime observation here
    // can reach a Supabase session.
    const actions = read("src/lib/actions.ts");
    expect(actions).toContain("הפעולה הזו זמינה לבעל העסק בלבד.");
    expect(actions).toContain("business_members");
  });

  it("still sends a genuine new signup to onboarding", () => {
    // The branch that was always correct must survive the fix.
    expect(read("src/lib/actions.ts")).toContain('redirect("/onboarding")');
  });
});
