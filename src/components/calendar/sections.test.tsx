// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Obligation } from "@/lib/compliance";
import {
  LapsedSection,
  ObligationRow,
  OverdueSection,
  PendingFilingsSection,
  PersonalTargetsSection,
} from "./sections";

/**
 * The obligations board, asserted as rendered output.
 *
 * Written after looking at these sections in a browser for the first time,
 * which is how three of the things below were found — none of them were visible
 * from reading the source.
 */
vi.mock("@/lib/actions", () => ({ markPeriodFiled: vi.fn() }));

afterEach(cleanup);

function ob(over: Partial<Obligation> = {}): Obligation {
  return {
    id: "x",
    kind: "vat",
    basis: "statutory",
    title: 'דיווח מע"מ תקופתי',
    dueDate: "2026-09-15",
    templateId: "vat-reporting",
    daysUntil: -5,
    periodLabel: "יולי–אוגוסט 2026",
    ruleText: "התקופה הייתה אמורה להיות מוגשת עד 15.09.2026.",
    sourceUrl: "https://www.gov.il/he/departments/israel_tax_authority",
    ...over,
  };
}

describe("how late, not just that it is late", () => {
  it("counts the days for a recent miss", () => {
    render(<ObligationRow ob={ob({ daysUntil: -5 })} />);
    expect(screen.getByText("באיחור 5 ימים")).toBeDefined();
  });

  it("distinguishes five days from five months", () => {
    // Seen side by side in a browser: both said "עבר המועד" and read as equally
    // urgent. Interest has been accruing on one of them for half a year.
    const { unmount } = render(<ObligationRow ob={ob({ daysUntil: -5 })} />);
    const short = screen.getByText(/באיחור/).textContent;
    unmount();
    render(<ObligationRow ob={ob({ daysUntil: -160 })} />);
    expect(screen.getByText(/באיחור/).textContent).not.toBe(short);
  });

  it("uses the Hebrew dual form rather than a number", () => {
    // "2 ימים" and "כ-2 חודשים" are the translated-from-English texture the
    // product has been clearing out.
    const { unmount } = render(<ObligationRow ob={ob({ daysUntil: -2 })} />);
    expect(screen.getByText("באיחור יומיים")).toBeDefined();
    unmount();
    render(<ObligationRow ob={ob({ daysUntil: -66 })} />);
    expect(screen.getByText("באיחור כחודשיים")).toBeDefined();
  });

  it("stops counting days once the number stops meaning anything", () => {
    render(<ObligationRow ob={ob({ daysUntil: -400 })} />);
    expect(screen.getByText("באיחור למעלה משנה")).toBeDefined();
  });

  it("says 'היום' on the day itself, which is not late", () => {
    render(<ObligationRow ob={ob({ daysUntil: 0 })} />);
    expect(screen.getByText("היום")).toBeDefined();
    expect(screen.queryByText(/באיחור/)).toBeNull();
  });
});

describe("the row never hides which obligation it is", () => {
  it("shows a long statutory title in full", () => {
    // At 375px this truncated to "אגרה שנתית לרש…", because the date column
    // holds a fixed width. Truncating a statutory obligation's name costs the
    // user the ability to tell which one they are late on.
    const title = "אגרה שנתית לרשם החברות";
    render(<ObligationRow ob={ob({ title, kind: "registrar_fee" })} />);
    expect(screen.getByText(title)).toBeDefined();
  });

  it("carries the reasoning and its source on every row", () => {
    render(<ObligationRow ob={ob()} />);
    expect(screen.getByRole("button", { name: /למה התאריך הזה/ })).toBeDefined();
  });
});

describe("clearing a missed period", () => {
  it("is offered on a period the user can clear", () => {
    render(<ObligationRow ob={ob({ periodKey: "2026-07..2026-08" })} canEdit />);
    expect(screen.getByRole("button", { name: /כבר הגשתי/ })).toBeDefined();
  });

  it("is not offered where there is no period to clear", () => {
    // A registrar fee is not a reporting period; there is nothing to mark.
    render(<ObligationRow ob={ob({ periodKey: null })} canEdit />);
    expect(screen.queryByRole("button", { name: /כבר הגשתי/ })).toBeNull();
  });

  it("is not offered to a viewer, whose write the database would reject", () => {
    render(<ObligationRow ob={ob({ periodKey: "2026-07..2026-08" })} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /כבר הגשתי/ })).toBeNull();
  });
});

describe("the overdue section", () => {
  it("counts what is late and says what it costs", () => {
    render(<OverdueSection canEdit overdue={[ob({ id: "a" }), ob({ id: "b" })]} />);
    expect(screen.getByRole("heading", { name: /2 חובות עברו את המועד/ })).toBeDefined();
    expect(screen.getByText(/צובר ריבית והצמדה מהיום הראשון/)).toBeDefined();
  });

  it("uses the singular for one", () => {
    render(<OverdueSection canEdit overdue={[ob()]} />);
    expect(screen.getByRole("heading", { name: /חובה אחת עברה את המועד/ })).toBeDefined();
  });

  it("renders nothing at all when nothing is late", () => {
    // Not an empty card: an empty "what is late" heading reads as reassurance
    // the rest of the page has not earned yet.
    const { container } = render(<OverdueSection canEdit overdue={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("duties that have not started", () => {
  it("names the duty and what unlocks it, both linked", () => {
    render(
      <PendingFilingsSection
        pending={[
          {
            templateId: "vat-reporting",
            title: 'דיווח מע"מ תקופתי',
            awaitingId: "open-vat-file",
            awaitingTitle: 'פתיחת תיק עוסק במע"מ',
          },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: 'דיווח מע"מ תקופתי' })).toBeDefined();
    expect(screen.getByRole("link", { name: 'פתיחת תיק עוסק במע"מ' })).toBeDefined();
  });

  it("says explicitly that these have no date yet", () => {
    // The alternative is a duty with a blank date, which reads as a bug.
    render(
      <PendingFilingsSection
        pending={[
          { templateId: "a", title: "א", awaitingId: "b", awaitingTitle: "ב" },
        ]}
      />
    );
    expect(screen.getByText(/אין להן עדיין תאריך/)).toBeDefined();
  });

  it("disappears when there are none", () => {
    const { container } = render(<PendingFilingsSection pending={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("the user's own targets", () => {
  it("keeps them under their own heading, not mixed into the statutory rows", () => {
    // A date you chose and a date the law fixed are different kinds of fact and
    // must not read as one.
    render(
      <PersonalTargetsSection
        targets={[{ templateId: "business-license", title: "רישיון עסק", date: "2026-10-01" }]}
      />
    );
    expect(screen.getByRole("heading", { name: /היעדים שקבעתם לעצמכם/ })).toBeDefined();
    expect(screen.getByText("1.10.2026")).toBeDefined();
  });

  it("disappears when there are none", () => {
    const { container } = render(<PersonalTargetsSection targets={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("the board leads somewhere", () => {
  it("makes the obligation title a link to its task", () => {
    // The page that tells you what is late offered no way to go and do it:
    // every title was a <p>. /insights already linked its rows this way.
    render(<ObligationRow ob={ob()} />);
    const link = screen.getByRole("link", { name: 'דיווח מע"מ תקופתי' });
    expect(link.getAttribute("href")).toBe("/tasks/vat-reporting?from=calendar");
  });

  it("does not pretend an expiry is a link when it has no task", () => {
    // A document expiry comes from the archive, not from a task.
    render(<ObligationRow ob={ob({ templateId: null, kind: "document_expiry" })} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText('דיווח מע"מ תקופתי')).toBeDefined();
  });
});

/**
 * A lapsed cover is not an interest-bearing debt.
 *
 * Everything past its date used to land in one group, under "חובות עברו את
 * המועד" with the line "איחור בדיווח או בתשלום צובר ריבית והצמדה מהיום הראשון".
 * True of a VAT period; false of an expired professional-liability policy — no
 * authority charges interest on it, and for most professions it is not a legal
 * duty at all. Overclaiming legal consequence is the one thing this product
 * must never do.
 */
describe("lapsed cover, said honestly", () => {
  const policy = () =>
    ob({
      id: "p1",
      kind: "renewal",
      basis: "renewal",
      title: "חידוש: ביטוח אחריות מקצועית",
      templateId: "professional-liability-insurance",
      periodLabel: null,
      periodKey: null,
      daysUntil: -95,
    });

  it("says outright that no interest is accruing", () => {
    render(<LapsedSection lapsed={[policy()]} />);
    expect(screen.getByText(/אין כאן קנס וריבית/)).toBeDefined();
  });

  it("states the consequence that IS real — no cover", () => {
    render(<LapsedSection lapsed={[policy()]} />);
    expect(screen.getByText(/לא תוכלו להציג אישור בתוקף/)).toBeDefined();
  });

  it("never borrows the statutory section's interest claim", () => {
    render(<LapsedSection lapsed={[policy()]} />);
    expect(screen.queryByText(/צובר ריבית והצמדה מהיום הראשון/)).toBeNull();
  });

  it("does not call it a חובה חוקית", () => {
    // The heading counts expiries, not legal duties.
    render(<LapsedSection lapsed={[policy()]} />);
    expect(screen.getByRole("heading", { name: /תוקף אחד פג/ })).toBeDefined();
  });

  it("uses the plural for more than one", () => {
    render(<LapsedSection lapsed={[policy(), { ...policy(), id: "p2" }]} />);
    expect(screen.getByRole("heading", { name: /2 תוקפים פגו/ })).toBeDefined();
  });

  it("renders nothing when nothing has lapsed", () => {
    const { container } = render(<LapsedSection lapsed={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("offers no 'כבר הגשתי' — there is no period to file", () => {
    // The off switch for a renewal is a new date on the task, not a filing.
    render(<LapsedSection lapsed={[policy()]} />);
    expect(screen.queryByRole("button", { name: /כבר הגשתי/ })).toBeNull();
  });
});

describe("a past-due row is worded and coloured by what it actually is", () => {
  const policy = (over = {}) =>
    ob({
      kind: "renewal",
      basis: "renewal",
      title: "חידוש: ביטוח אחריות מקצועית",
      templateId: "professional-liability-insurance",
      periodLabel: null,
      periodKey: null,
      daysUntil: -95,
      ...over,
    });

  it("does not say 'באיחור' about a cover that lapsed", () => {
    // "באיחור" is a claim that a deadline was missed. An expired policy missed
    // no deadline — there is simply no cover.
    render(<ObligationRow ob={policy()} />);
    expect(screen.queryByText(/באיחור/)).toBeNull();
    expect(screen.getByText(/פג לפני כ-3 חודשים/)).toBeDefined();
  });

  it("still says 'באיחור' about a statutory filing", () => {
    render(<ObligationRow ob={ob({ daysUntil: -95 })} />);
    expect(screen.getByText("באיחור כ-3 חודשים")).toBeDefined();
  });

  it("shares one duration vocabulary between the two", () => {
    // Same underlying fact, same words for "how long" — only the claim differs.
    const { unmount } = render(<ObligationRow ob={ob({ daysUntil: -66 })} />);
    expect(screen.getByText("באיחור כחודשיים")).toBeDefined();
    unmount();
    render(<ObligationRow ob={policy({ daysUntil: -66 })} />);
    expect(screen.getByText("פג לפני כחודשיים")).toBeDefined();
  });
});
