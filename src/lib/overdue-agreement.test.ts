import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeUpcomingObligations,
  overdueStatutory,
  type ComplianceTask,
} from "@/lib/compliance";
import { TEMPLATES_BY_ID } from "@/lib/content";

/**
 * "You are late" is one count, computed in one place.
 *
 * Home, /insights and /calendar each filtered computeUpcomingObligations with
 * their own expression, and they were not the same expression: Home first
 * removed journey-LOCKED templates, /insights first kept only rows with a
 * templateId or a document expiry, /calendar filtered nothing.
 *
 * They did agree. A statutory obligation the engine emits can never be locked,
 * because compliance's prereqsMet and journey's "locked" both call
 * satisfiesDependency with the same statutory flag; and a statutory obligation
 * always carries a templateId. Both are real arguments rather than obvious
 * ones, and neither was written down anywhere.
 *
 * My first version of this file asserted that the three agreed by REPLICATING
 * all three expressions here and comparing them. That passes forever: the
 * expressions under test lived in the test, so a page could change its filter
 * and nothing would notice. Agreement that has to be argued — or observed from
 * a copy — is agreement that breaks. A9 was exactly this shape, two places
 * computing overdue from different inputs and the wrong one inventing statutory
 * debts, showing a new עוסק מורשה a red "יש חוב אחד באיחור" for a duty that did
 * not legally exist while the calendar showed nothing due.
 *
 * So there is one exported function, all three call it, and this asserts both
 * halves: what the function does, and that each page still uses it.
 */
const TODAY = new Date("2026-09-20T09:00:00Z");
const PROFILE = { entityType: "osek_murshe", vatFrequency: "bimonthly" as const };
const VAT = "vat-reporting";
const VAT_FILE = "open-vat-file";

function task(partial: Partial<ComplianceTask> & { template_id: string }): ComplianceTask {
  return {
    status: "todo",
    is_relevant: true,
    completion_data: null,
    completed_at: null,
    ...partial,
  };
}

function lateCount(tasks: ComplianceTask[]): number {
  const obligations = computeUpcomingObligations(tasks, TEMPLATES_BY_ID, [], TODAY, PROFILE);
  return overdueStatutory(obligations).length;
}

describe("the count itself", () => {
  it("counts a statutory filing past its date", () => {
    // VAT file open, May-June period due 15 July, unfiled on 20 September.
    expect(
      lateCount([
        task({ template_id: VAT_FILE, status: "done", completed_at: "2026-01-05T09:00:00Z" }),
        task({ template_id: VAT, due_date: "2026-07-15" }),
      ])
    ).toBeGreaterThan(0);
  });

  it("counts nothing for a duty that has not started — the A9 case", () => {
    // No VAT file, so no VAT duty. This is the number Home used to invent.
    expect(
      lateCount([task({ template_id: VAT_FILE }), task({ template_id: VAT, due_date: "2026-07-15" })])
    ).toBe(0);
  });

  it("does not let a dismissal start a penalty-bearing duty", () => {
    expect(
      lateCount([
        task({ template_id: VAT_FILE, status: "not_relevant", dismissal: "not_applicable" }),
        task({ template_id: VAT, due_date: "2026-07-15" }),
      ])
    ).toBe(0);
  });

  it("never calls a non-statutory obligation late", () => {
    // A lapsed professional-liability policy is on the board, and it is not an
    // "איחור": no authority charges interest on it. Overclaiming legal
    // consequence is the one thing this product must not do.
    const obligations = computeUpcomingObligations(
      [
        task({
          template_id: "professional-liability-insurance",
          status: "done",
          completed_at: "2025-03-10T09:00:00Z",
          completion_data: { renewal: "2026-03-10" },
        }),
      ],
      TEMPLATES_BY_ID,
      [],
      TODAY,
      PROFILE
    );
    expect(obligations.some((o) => o.daysUntil < 0)).toBe(true);
    expect(overdueStatutory(obligations)).toEqual([]);
  });

  it("never calls something late on its due date itself", () => {
    expect(overdueStatutory([{ basis: "statutory", daysUntil: 0 }])).toEqual([]);
    expect(overdueStatutory([{ basis: "statutory", daysUntil: -1 }])).toHaveLength(1);
  });

  it("preserves the caller's row type, so the board keeps its fields", () => {
    // The calendar needs the rows themselves for OverdueSection, not a count.
    const rows = [
      { basis: "statutory", daysUntil: -5, title: "דיווח מע״מ", templateId: VAT },
      { basis: "renewal", daysUntil: -5, title: "ביטוח", templateId: null },
    ];
    const late = overdueStatutory(rows);
    expect(late).toHaveLength(1);
    expect(late[0].title).toBe("דיווח מע״מ");
  });
});

describe("every surface that shows a late count uses it", () => {
  /**
   * Read at the source, because this is the half a behavioural test cannot
   * reach: the function can be perfectly correct while a page goes back to
   * filtering by hand, which is the state this replaced.
   */
  const SURFACES = [
    "src/app/(app)/home/page.tsx",
    "src/app/(app)/insights/page.tsx",
    "src/app/(app)/calendar/page.tsx",
  ];

  function read(rel: string): string {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  it("calls overdueStatutory rather than filtering by hand", () => {
    for (const file of SURFACES) {
      const src = read(file);
      expect(src, `${file} does not call overdueStatutory`).toContain("overdueStatutory(");
      expect(src, `${file} filters lateness by hand again`).not.toMatch(
        /basis === "statutory" && o\.daysUntil < 0/
      );
    }
  });

  it("feeds it the engine's own output, so the input matches too", () => {
    // Passing a pre-filtered list is the subtler regression: same function,
    // different input, two numbers again.
    for (const file of SURFACES) {
      expect(read(file), `${file} narrows the input first`).toContain(
        "overdueStatutory(obligations)"
      );
    }
  });
});
