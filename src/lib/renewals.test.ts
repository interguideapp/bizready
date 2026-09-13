import { describe, expect, it } from "vitest";
import { computeUpcomingObligations } from "@/lib/compliance";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { nextCycleFor, reopenedCycle } from "@/lib/cycles";
import { openRenewalOf, renewalDateOf } from "@/lib/renewals";

/**
 * The renewal nobody could clear.
 *
 * `completion_data.renewal` is the expiry a user types when they finish an
 * insurance, licence or certificate task, and completeTask MERGES that column
 * on every later completion — deliberately, so webhook evidence survives. The
 * renewal field is optional and the completion form starts empty, so
 * re-finishing the task without retyping the date leaves the OLD expiry in
 * place. All three readers then called that stale date lapsed cover.
 *
 * So: buy the new policy, mark the task done, and the board immediately says
 * your cover expired N days ago. Mark it done again, same thing. Forever. A
 * product whose promise is "impossible to miss a deadline" had an alarm with no
 * off switch, which is the same failure as a missed deadline — an alarm nobody
 * can clear is an alarm nobody reads.
 *
 * openRenewalOf is the one rule that fixes it, and these are its cases.
 */
const TPL = "professional-liability-insurance";
const template = TEMPLATES_BY_ID.get(TPL)!;
const today = new Date("2026-09-13T09:00:00Z");

function policy(renewal: string, completedAt: string | null) {
  return {
    template_id: TPL,
    status: "done" as const,
    due_date: null,
    is_relevant: true,
    completed_at: completedAt,
    completion_data: { insurer: "X", renewal },
  };
}

describe("a renewal the user has already dealt with is closed", () => {
  it("does not reopen the task the moment it is re-completed", () => {
    // Cover ran out on 1 Sep. The user bought a new policy and ticked the task
    // done today, leaving the optional date field alone.
    const task = policy("2026-09-01", "2026-09-13T08:00:00Z");
    expect(openRenewalOf(task)).toBeNull();
    expect(reopenedCycle({ task, template, today })).toBeNull();
  });

  it("does not put it back on the obligations board either", () => {
    const obs = computeUpcomingObligations(
      [policy("2026-09-01", "2026-09-13T08:00:00Z")],
      TEMPLATES_BY_ID,
      [],
      today
    );
    expect(obs.some((o) => o.kind === "renewal")).toBe(false);
  });

  it("falls through to the yearly recurrence for what comes next", () => {
    /**
     * The safety net for the user who renews without retyping the date. Once
     * the stale expiry is closed, the template's own yearly recurrence answers
     * "when is the next one" — about a year from the renewal they just did —
     * so the task still says something about the next period instead of going
     * quiet. I expected null here and was wrong; this answer is better.
     */
    const task = policy("2026-09-01", "2026-09-13T08:00:00Z");
    expect(nextCycleFor({ task, template, today })).toMatchObject({
      reason: "habit",
      dueIso: "2027-09-13",
      open: false,
    });
  });
});

describe("cover that genuinely lapsed is untouched", () => {
  it("keeps an annual policy nobody renewed", () => {
    // Bought a year before it expired, and not touched since: the expiry came
    // AFTER the completion, so nothing says the user acted on it.
    const task = policy("2026-03-10", "2025-03-10T09:00:00Z");
    expect(openRenewalOf(task)).toBe("2026-03-10");
    expect(reopenedCycle({ task, template, today })).toMatchObject({
      reason: "renewal",
      dueIso: "2026-03-10",
    });
    const obs = computeUpcomingObligations([task], TEMPLATES_BY_ID, [], today);
    expect(obs.some((o) => o.kind === "renewal")).toBe(true);
  });

  it("keeps one on a row that has no completion timestamp at all", () => {
    // Rows predating the column, and rows a webhook wrote. Absent evidence that
    // the user renewed, the expiry stands.
    expect(openRenewalOf(policy("2026-03-10", null))).toBe("2026-03-10");
  });

  it("tracks the NEW expiry when the user does retype it", () => {
    // The path that keeps tracking alive into the next period.
    const task = policy("2027-09-01", "2026-09-13T08:00:00Z");
    expect(openRenewalOf(task)).toBe("2027-09-01");
    expect(nextCycleFor({ task, template, today })).toMatchObject({
      reason: "renewal",
      dueIso: "2027-09-01",
      open: false,
    });
  });
});

describe("the comparison is on the Israel calendar day", () => {
  /**
   * completed_at is a UTC instant and the expiry is a local calendar date.
   * Someone who renews at 01:00 on 2 September has completed it on the 2nd; a
   * naive slice(0, 10) of the timestamp reads 1 September and reopens the task
   * they just closed. This is the one-day version of the same permanent alarm.
   */
  it("counts a renewal made after local midnight as that day", () => {
    expect(openRenewalOf(policy("2026-09-02", "2026-09-01T22:00:00Z"))).toBeNull();
  });

  it("still leaves the day before open", () => {
    expect(openRenewalOf(policy("2026-09-02", "2026-09-01T10:00:00Z"))).toBe("2026-09-02");
  });
});

describe("one parser for the field", () => {
  /**
   * compliance.ts used to accept anything `new Date()` could parse and then
   * reformat it, while cycles.ts demanded a strict yyyy-mm-dd. So "2026" was an
   * obligation on the board and invisible to the reminder sweep — the two
   * surfaces disagreeing about whether cover had lapsed.
   */
  it("refuses a value that is not a full date", () => {
    for (const raw of ["2026", "01/09/2026", "next year", ""]) {
      expect(renewalDateOf({ completion_data: { renewal: raw } })).toBeNull();
    }
  });

  it("and the board agrees, rather than inventing a date from it", () => {
    const obs = computeUpcomingObligations(
      [{ ...policy("2026-09-01", null), completion_data: { renewal: "2026" } }],
      TEMPLATES_BY_ID,
      [],
      today
    );
    expect(obs.some((o) => o.kind === "renewal")).toBe(false);
  });
});
