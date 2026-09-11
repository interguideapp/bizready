import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  computeUpcomingObligations,
  isStatutoryFiling,
  type ComplianceProfile,
} from "@/lib/compliance";
import { computeReminders, type ReminderTask } from "@/lib/reminders";

/**
 * The two engines must never disagree about whether you are late.
 *
 * This file exists because they did. On 20 September, with a 15 September VAT
 * deadline missed and the task still open, the reminder sweep produced an
 * "overdue" notification while the obligations board showed the next period 56
 * days out and no lateness at all. A user who acted on the email and opened the
 * board found a calm future date.
 *
 * That is the same defect class the audit removed from the home screen (A9),
 * where two places computed overdue from different inputs and the wrong one
 * invented statutory debts. Fixing an instance is not enough — the shape comes
 * back — so the agreement itself is asserted here, over a matrix of cases
 * rather than the one that happened to break.
 */

const PROFILES: { name: string; profile: ComplianceProfile }[] = [
  { name: "bimonthly osek murshe", profile: { entityType: "osek_murshe", vatFrequency: "bimonthly" } },
  { name: "monthly osek murshe", profile: { entityType: "osek_murshe", vatFrequency: "monthly" } },
];

/** Days the reminder engine considers this task late, or null when it does not. */
function remindersSayLate(
  tasks: ReminderTask[],
  today: Date,
  profile: ComplianceProfile
): boolean {
  const { notifications } = computeReminders(tasks, TEMPLATES_BY_ID, today, true, profile);
  return notifications.some((n) => n.type === "overdue");
}

/** Does the obligations board show this template as past its date? */
function boardSaysLate(
  templateId: string,
  storedDue: string | null,
  today: Date,
  profile: ComplianceProfile,
  prerequisiteDone = true
): boolean {
  const obligations = computeUpcomingObligations(
    [
      { template_id: "open-vat-file", status: prerequisiteDone ? "done" : "todo", is_relevant: true },
      { template_id: templateId, status: "todo", is_relevant: true, due_date: storedDue },
    ],
    TEMPLATES_BY_ID,
    [],
    today,
    profile
  );
  return obligations.some((o) => o.templateId === templateId && o.daysUntil < 0);
}

describe("the reminder sweep and the obligations board agree about lateness", () => {
  for (const { name, profile } of PROFILES) {
    describe(name, () => {
      // A deadline that has passed, across several distances, including one
      // well beyond the sixty-day history window that used to hide it.
      for (const [label, storedDue, today] of [
        ["one day late", "2026-09-15", "2026-09-16"],
        ["five days late", "2026-09-15", "2026-09-20"],
        ["a month late", "2026-09-15", "2026-10-16"],
        ["ten weeks late", "2026-05-15", "2026-07-25"],
        ["nearly a year late", "2026-01-15", "2026-12-01"],
      ] as const) {
        it(`both report late: ${label}`, () => {
          const now = new Date(`${today}T09:00:00Z`);
          const tasks: ReminderTask[] = [
            {
              id: "a",
              template_id: "open-vat-file",
              status: "done",
              is_relevant: true,
              due_date: null,
              completed_at: "2026-01-01T00:00:00Z",
            },
            {
              id: "b",
              template_id: "vat-reporting",
              status: "todo",
              is_relevant: true,
              due_date: storedDue,
              completed_at: null,
            },
          ];
          expect(remindersSayLate(tasks, now, profile)).toBe(true);
          expect(boardSaysLate("vat-reporting", storedDue, now, profile)).toBe(true);
        });
      }

      it("neither reports late before the deadline", () => {
        const now = new Date("2026-09-10T09:00:00Z");
        const tasks: ReminderTask[] = [
          {
            id: "a",
            template_id: "open-vat-file",
            status: "done",
            is_relevant: true,
            due_date: null,
            completed_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "b",
            template_id: "vat-reporting",
            status: "todo",
            is_relevant: true,
            due_date: "2026-09-15",
            completed_at: null,
          },
        ];
        expect(remindersSayLate(tasks, now, profile)).toBe(false);
        expect(boardSaysLate("vat-reporting", "2026-09-15", now, profile)).toBe(false);
      });

      it("neither reports late while the prerequisite is unfinished", () => {
        // The gate that stopped the product inventing debts for a business with
        // no VAT file. Both engines have to respect it, or the one that does not
        // becomes the source of a fabricated penalty.
        const now = new Date("2026-09-20T09:00:00Z");
        const tasks: ReminderTask[] = [
          {
            id: "a",
            template_id: "open-vat-file",
            status: "todo",
            is_relevant: true,
            due_date: null,
            completed_at: null,
          },
          {
            id: "b",
            template_id: "vat-reporting",
            status: "todo",
            is_relevant: true,
            due_date: "2026-09-15",
            completed_at: null,
          },
        ];
        expect(boardSaysLate("vat-reporting", "2026-09-15", now, profile, false)).toBe(false);
        // The reminder engine reaches the same conclusion by its own route,
        // which is what makes this an agreement rather than a coincidence.
        expect(remindersSayLate(tasks, now, profile)).toBe(false);
      });
    });
  }
});

describe("only things that can be late are ever called late", () => {
  it("never reports overdue for an obligation with no dated rule", () => {
    // A demand-triggered duty (הצהרת הון) has no computable deadline, so
    // calling it late would be a fabricated legal claim.
    const now = new Date("2026-09-20T09:00:00Z");
    const obligations = computeUpcomingObligations(
      [
        task("open-vat-file", "done"),
        { template_id: "capital-statement-prep", status: "todo", is_relevant: true, due_date: "2026-01-01" },
      ],
      TEMPLATES_BY_ID,
      [],
      now,
      { entityType: "osek_murshe" }
    );
    const late = obligations.filter((o) => o.daysUntil < 0);
    for (const o of late) {
      expect(isStatutoryFiling(o.templateId ?? ""), `${o.templateId} reported late`).toBe(true);
    }
    expect(late.some((o) => o.templateId === "capital-statement-prep")).toBe(false);
  });

  it("every overdue obligation carries a source, so the claim is checkable", () => {
    const now = new Date("2026-09-20T09:00:00Z");
    const obligations = computeUpcomingObligations(
      [
        task("open-vat-file", "done"),
        { template_id: "vat-reporting", status: "todo", is_relevant: true, due_date: "2026-09-15" },
      ],
      TEMPLATES_BY_ID,
      [],
      now,
      { entityType: "osek_murshe", vatFrequency: "bimonthly" }
    );
    for (const o of obligations.filter((x) => x.daysUntil < 0)) {
      expect(o.sourceUrl, `${o.id} has no source`).toBeTruthy();
      expect(o.ruleText.length).toBeGreaterThan(20);
    }
  });
});

function task(template_id: string, status: string) {
  return { template_id, status, is_relevant: true };
}
