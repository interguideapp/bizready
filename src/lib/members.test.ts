import { describe, expect, it } from "vitest";
import {
  capabilitiesFor,
  looksLikeEmail,
  memberState,
  normaliseEmail,
  type MemberRow,
} from "./members";

const row = (over: Partial<MemberRow> = {}): MemberRow => ({
  id: "m1",
  business_id: "b1",
  user_id: null,
  invited_email: "cpa@example.com",
  role: "accountant",
  invited_at: "2026-09-01T00:00:00Z",
  accepted_at: null,
  revoked_at: null,
  ...over,
});

describe("capabilities", () => {
  it("an owner can do everything", () => {
    const caps = capabilitiesFor("owner");
    expect(Object.values(caps).every(Boolean)).toBe(true);
  });

  it("an accountant can do the filing work and nothing beyond it", () => {
    const caps = capabilitiesFor("accountant");
    expect(caps.read).toBe(true);
    expect(caps.completeTasks).toBe(true);
    // The business card holds the bank account. An accountant needs to READ
    // it and has no business changing it.
    expect(caps.editBusinessCard).toBe(false);
    // Recalibrating rewrites the entire plan — a decision about the business.
    expect(caps.recalibrate).toBe(false);
    expect(caps.manageMembers).toBe(false);
    expect(caps.manageBilling).toBe(false);
    // Export and deletion are rights of the data subject, not services an
    // advisor performs for them.
    expect(caps.managePrivacy).toBe(false);
  });

  it("a viewer changes nothing at all", () => {
    const caps = capabilitiesFor("viewer");
    expect(caps.read).toBe(true);
    const { read, ...rest } = caps;
    expect(read).toBe(true);
    expect(Object.values(rest).some(Boolean)).toBe(false);
  });

  it("no non-owner can ever touch billing or membership", () => {
    // Both are also blocked in the database, so a bug here cannot become a
    // breach — but the two must agree.
    for (const role of ["accountant", "viewer"] as const) {
      expect(capabilitiesFor(role).manageBilling, role).toBe(false);
      expect(capabilitiesFor(role).manageMembers, role).toBe(false);
    }
  });

  it("a viewer cannot complete a task", () => {
    // Completing writes evidence into a hash-chained audit trail under someone
    // else's business. "Read only" has to mean it.
    expect(capabilitiesFor("viewer").completeTasks).toBe(false);
  });
});

describe("memberState", () => {
  it("is invited until accepted", () => {
    expect(memberState(row())).toBe("invited");
  });

  it("is active once accepted", () => {
    expect(memberState(row({ accepted_at: "2026-09-02T00:00:00Z", user_id: "u2" }))).toBe(
      "active"
    );
  });

  it("is revoked regardless of having been accepted", () => {
    // Revocation wins. A revoked row keeps accepted_at for the history, and
    // reading it as active would leave a removed accountant looking present.
    expect(
      memberState(
        row({ accepted_at: "2026-09-02T00:00:00Z", revoked_at: "2026-09-05T00:00:00Z" })
      )
    ).toBe("revoked");
  });
});

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  CPA@Example.COM ")).toBe("cpa@example.com");
  });

  it("does NOT strip dots or plus-suffixes", () => {
    // Those are provider-specific conventions. Treating a+b@gmail.com as
    // a@gmail.com would send the invitation to a different inbox than the one
    // the owner typed, which is not a normalisation — it is a redirect.
    expect(normaliseEmail("a+cpa@gmail.com")).toBe("a+cpa@gmail.com");
    expect(normaliseEmail("first.last@gmail.com")).toBe("first.last@gmail.com");
  });
});

describe("looksLikeEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const ok of ["cpa@example.com", "a.b+c@sub.domain.co.il", "x@y.io"]) {
      expect(looksLikeEmail(ok), ok).toBe(true);
    }
  });

  it("rejects what is obviously not an address", () => {
    for (const value of ["", "cpa", "cpa@", "@example.com", "a b@c.com", "a@b"]) {
      expect(looksLikeEmail(value), value).toBe(false);
    }
  });
});
