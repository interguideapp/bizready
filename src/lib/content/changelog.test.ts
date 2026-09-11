import { describe, expect, it } from "vitest";
import {
  changeBannerText,
  isConsequential,
  relevantChanges,
  type ChangelogEntry,
} from "./changelog";

const entry = (over: Partial<ChangelogEntry> & { id: string }): ChangelogEntry => ({
  template_id: "vat-reporting",
  summary: "שינוי",
  change_kind: "guidance",
  source_url: "https://www.gov.il/x",
  effective_from: null,
  published_at: "2026-09-01T00:00:00Z",
  ...over,
});

const TITLES: Record<string, string> = {
  "vat-reporting": 'דיווחי מע"מ תקופתיים',
  "patur-ceiling-watch": "מעקב אחרי תקרת עוסק פטור",
  "company-annual-fee": "אגרה שנתית לרשם החברות",
};
const titleFor = (id: string) => TITLES[id];

describe("only changes that affect THIS business are shown", () => {
  it("drops a change about a task the user does not have", () => {
    // A blanket "the law changed" notice teaches people to dismiss these, which
    // is worse than not sending them at all.
    const changes = relevantChanges(
      [entry({ id: "a", template_id: "company-annual-fee" })],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changes).toEqual([]);
  });

  it("keeps a change about a task the user does have", () => {
    const changes = relevantChanges(
      [entry({ id: "a", template_id: "vat-reporting" })],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].title).toBe('דיווחי מע"מ תקופתיים');
    // ?from=home so the task page's back link returns the user to the home
    // screen they clicked from, rather than dumping them on /tasks.
    expect(changes[0].href).toBe("/tasks/vat-reporting?from=home");
  });

  it("drops a change about a template we can no longer name", () => {
    // Otherwise it renders as a notice about nothing, or worse, about a raw id.
    const changes = relevantChanges(
      [entry({ id: "a", template_id: "deleted-template" })],
      new Set(["deleted-template"]),
      titleFor
    );
    expect(changes).toEqual([]);
  });

  it("hides what the user has already read", () => {
    const changes = relevantChanges(
      [entry({ id: "a" }), entry({ id: "b" })],
      new Set(["vat-reporting"]),
      titleFor,
      new Set(["a"])
    );
    expect(changes.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("ordered by consequence", () => {
  it("a moved deadline outranks everything else", () => {
    // It is the one change that can make someone late through no fault of
    // their own.
    const changes = relevantChanges(
      [
        entry({ id: "guidance", change_kind: "guidance" }),
        entry({ id: "amount", change_kind: "amount" }),
        entry({ id: "deadline", change_kind: "deadline" }),
        entry({ id: "rule", change_kind: "rule" }),
      ],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changes.map((c) => c.id)).toEqual(["deadline", "amount", "rule", "guidance"]);
  });

  it("breaks ties on recency, newest first", () => {
    const changes = relevantChanges(
      [
        entry({ id: "older", change_kind: "amount", published_at: "2026-01-01T00:00:00Z" }),
        entry({ id: "newer", change_kind: "amount", published_at: "2026-09-01T00:00:00Z" }),
      ],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changes.map((c) => c.id)).toEqual(["newer", "older"]);
  });

  it("is stable regardless of input order", () => {
    const a = entry({ id: "a", change_kind: "deadline" });
    const b = entry({ id: "b", change_kind: "guidance" });
    const ids = new Set(["vat-reporting"]);
    expect(relevantChanges([a, b], ids, titleFor).map((c) => c.id)).toEqual(["a", "b"]);
    expect(relevantChanges([b, a], ids, titleFor).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("a clarification is not an alarm", () => {
  it("guidance is not consequential; everything else is", () => {
    expect(isConsequential("guidance")).toBe(false);
    for (const kind of ["deadline", "amount", "rule"] as const) {
      expect(isConsequential(kind), kind).toBe(true);
    }
  });
});

describe("changeBannerText says what kind, not just how many", () => {
  it("leads with a moved deadline", () => {
    const changes = relevantChanges(
      [entry({ id: "a", change_kind: "deadline" }), entry({ id: "b", change_kind: "guidance" })],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changeBannerText(changes)).toContain("מועד");
  });

  it("counts multiple deadlines", () => {
    const changes = relevantChanges(
      [
        entry({ id: "a", change_kind: "deadline" }),
        entry({ id: "b", change_kind: "deadline", template_id: "patur-ceiling-watch" }),
      ],
      new Set(["vat-reporting", "patur-ceiling-watch"]),
      titleFor
    );
    expect(changeBannerText(changes)).toContain("2 מועדים");
  });

  it("falls back to rules when no deadline moved", () => {
    const changes = relevantChanges(
      [entry({ id: "a", change_kind: "amount" })],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changeBannerText(changes)).toContain("כלל");
  });

  it("describes clarifications as clarifications", () => {
    const changes = relevantChanges(
      [entry({ id: "a", change_kind: "guidance" })],
      new Set(["vat-reporting"]),
      titleFor
    );
    expect(changeBannerText(changes)).toContain("הבהרה");
  });

  it("says nothing when there is nothing", () => {
    expect(changeBannerText([])).toBeNull();
  });
});
