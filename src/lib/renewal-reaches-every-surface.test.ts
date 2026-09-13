import { describe, expect, it } from "vitest";
import { computeReminders } from "@/lib/reminders";
import { computeUpcomingObligations, type ComplianceTask } from "@/lib/compliance";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { nextCycleFor, reopenedCycle } from "@/lib/cycles";

/**
 * A lapsed policy must reach the alerts list, not only the board.
 *
 * The renewal branch in computeReminders fires on `!ahead.open` — a renewal
 * that has NOT arrived yet — and then `continue`s. Reading that alone, cover
 * which already expired produces no draft at all, which would mean an owner
 * three months without insurance saw it in the obligations board's lapsed
 * section and NOWHERE else: no alert, no email, ever. On the product whose
 * promise is that nothing gets missed.
 *
 * It is in fact covered, by the branch above it: reopenedCycle returns the
 * renewal, the sweep reopens the task and pushes a "מועד חידוש" alert. That is
 * worth an explicit test rather than a reading, because openRenewalOf was
 * changed today and sits directly in this path — and because the two branches
 * are mutually exclusive by a `continue`, so a change to either silently
 * decides whether lapsed cover is announced at all.
 */
const TPL = "professional-liability-insurance";
const template = TEMPLATES_BY_ID.get(TPL)!;
const TODAY = new Date("2026-09-13T09:00:00Z");

/** An annual policy bought a year before it expired, never renewed since. */
function lapsed(renewal: string, boughtAt: string) {
  return {
    id: "t1",
    template_id: TPL,
    status: "done" as const,
    is_relevant: true,
    due_date: null,
    completed_at: boughtAt,
    completion_data: { insurer: "X", renewal },
  };
}

describe("cover that expired is announced", () => {
  it("produces exactly one alert, naming it as a renewal", () => {
    const { notifications } = computeReminders(
      [lapsed("2026-03-10", "2025-03-10T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    const renewals = notifications.filter((n) => n.template_id === TPL);
    expect(renewals).toHaveLength(1);
    expect(renewals[0].type).toBe("recurring");
    expect(renewals[0].title).toContain("מועד חידוש");
  });

  it("reopens the task, so it stops reading as done", () => {
    const { recurringResets } = computeReminders(
      [lapsed("2026-03-10", "2025-03-10T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    expect(recurringResets).toEqual([
      { taskId: "t1", templateId: TPL, newDueDate: "2026-03-10" },
    ]);
  });

  it("keys the alert to the renewal date, so it fires once and not daily", () => {
    const { notifications } = computeReminders(
      [lapsed("2026-03-10", "2025-03-10T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    expect(notifications[0].dedupe_key).toBe(`recurring:${TPL}:2026-03-10`);
  });

  it("stays on the obligations board at the same time", () => {
    // Both surfaces, one fact. The board keeps lapsed cover visible however
    // long ago it expired, because the exposure grows rather than ages out.
    const task: ComplianceTask = {
      template_id: TPL,
      status: "done",
      is_relevant: true,
      completed_at: "2025-03-10T09:00:00Z",
      completion_data: { insurer: "X", renewal: "2026-03-10" },
    };
    const obs = computeUpcomingObligations([task], TEMPLATES_BY_ID, [], TODAY);
    const renewal = obs.find((o) => o.kind === "renewal");
    expect(renewal).toBeDefined();
    expect(renewal!.daysUntil).toBeLessThan(0);
  });

  it("is still announced when the expiry is only just past", () => {
    // The boundary the two mutually-exclusive branches meet at: one day over
    // must not fall between them.
    const { notifications } = computeReminders(
      [lapsed("2026-09-12", "2025-09-12T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    expect(notifications.filter((n) => n.template_id === TPL)).toHaveLength(1);
  });
});

describe("cover that has NOT expired is warned about in advance", () => {
  it("uses the escalating window, not the expiry day itself", () => {
    // 14 days out, Pro. The product promises "נזכיר לכם לפני שהוא פג".
    const { notifications } = computeReminders(
      [lapsed("2026-09-27", "2025-09-27T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    const n = notifications.find((x) => x.template_id === TPL)!;
    expect(n.type).toBe("deadline");
    expect(n.dedupe_key).toBe(`renewal:${TPL}:2026-09-27:14`);
  });

  it("says nothing yet when the expiry is beyond every window", () => {
    const { notifications } = computeReminders(
      [lapsed("2027-03-10", "2026-03-10T09:00:00Z")],
      TEMPLATES_BY_ID,
      TODAY,
      true
    );
    expect(notifications.filter((n) => n.template_id === TPL)).toEqual([]);
  });

  it("and the two branches never both fire for one policy", () => {
    // They are separated by a `continue`, so a double alert would mean the
    // same policy announced twice in one sweep.
    for (const renewal of ["2026-03-10", "2026-09-12", "2026-09-13", "2026-09-27", "2027-03-10"]) {
      const boughtAt = String(Number(renewal.slice(0, 4)) - 1) + renewal.slice(4) + "T09:00:00Z";
      const { notifications } = computeReminders(
        [lapsed(renewal, boughtAt)],
        TEMPLATES_BY_ID,
        TODAY,
        true
      );
      expect(
        notifications.filter((n) => n.template_id === TPL).length,
        `renewal ${renewal}`
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe("the read path agrees with the sweep about which it is", () => {
  it("calls an expired policy open and a future one not", () => {
    const expired = lapsed("2026-03-10", "2025-03-10T09:00:00Z");
    const future = lapsed("2026-09-27", "2025-09-27T09:00:00Z");
    expect(reopenedCycle({ task: expired, template, today: TODAY })).toMatchObject({
      reason: "renewal",
    });
    expect(reopenedCycle({ task: future, template, today: TODAY })).toBeNull();
    expect(nextCycleFor({ task: future, template, today: TODAY })).toMatchObject({
      reason: "renewal",
      open: false,
    });
  });
});
