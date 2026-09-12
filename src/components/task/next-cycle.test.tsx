// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NextCycleNote, ReopenedNote, whenPhrase, type CycleNote } from "./next-cycle";

/**
 * What the screen says about the next cycle.
 *
 * A recurring duty used to end at "בוצע": nothing said when the next report was
 * due, and when the task reopened it reopened silently — reading as if the
 * product had lost work the user remembered doing.
 */

afterEach(cleanup);

const TODAY = "2026-09-13";

function note(over: Partial<CycleNote> = {}): CycleNote {
  return { reason: "period", dueIso: "2026-11-15", periodLabel: "ספטמבר–אוקטובר 2026", open: false, ...over };
}

describe("a reopening explains itself", () => {
  it("names the period that is now open", () => {
    render(<ReopenedNote cycle={note()} todayIso={TODAY} />);
    expect(screen.getByRole("heading", { name: /ספטמבר–אוקטובר 2026/ })).toBeDefined();
  });

  it("says outright that the earlier work was kept", () => {
    // This is the difference between "a new period started" and "the app forgot
    // I filed". The user has to be told which one happened.
    render(<ReopenedNote cycle={note()} todayIso={TODAY} />);
    expect(screen.getByText(/נשמר — זאת תקופה חדשה, לא איפוס/)).toBeDefined();
  });

  it("reads as overdue when the deadline is already behind", () => {
    render(<ReopenedNote cycle={note({ dueIso: "2026-09-08" })} todayIso={TODAY} />);
    expect(screen.getByText(/באיחור 5 ימים/)).toBeDefined();
  });

  it("does not claim lateness for a deadline still ahead", () => {
    render(<ReopenedNote cycle={note()} todayIso={TODAY} />);
    expect(screen.queryByText(/באיחור/)).toBeNull();
  });

  it("attributes a renewal to the date the user gave us", () => {
    // Not a date we chose. Saying so is what makes it correctable.
    render(
      <ReopenedNote
        cycle={note({ reason: "renewal", dueIso: "2026-09-13", periodLabel: null })}
        todayIso={TODAY}
      />
    );
    expect(screen.getByRole("heading", { name: /מועד החידוש/ })).toBeDefined();
    expect(screen.getByText(/לפי התאריך שרשמתם/)).toBeDefined();
  });

  it("does not advise renewing 'before the date' once the date has arrived", () => {
    // Seen in a browser: on the expiry day itself the card said
    // "כדאי לחדש לפני המועד", which is advice the reader can no longer take.
    render(
      <ReopenedNote
        cycle={note({ reason: "renewal", dueIso: TODAY, periodLabel: null })}
        todayIso={TODAY}
      />
    );
    expect(screen.getByText(/התוקף נגמר היום/)).toBeDefined();
    expect(screen.queryByText(/לפני המועד/)).toBeNull();
  });

  it("calls a renewal a renewal, not a reporting period", () => {
    // The reassurance line said "זאת תקופה חדשה" on an insurance policy, which
    // is period vocabulary applied to something that has no periods.
    render(
      <ReopenedNote
        cycle={note({ reason: "renewal", dueIso: TODAY, periodLabel: null })}
        todayIso={TODAY}
      />
    );
    expect(screen.getByText(/חידוש של אותו כיסוי/)).toBeDefined();
  });
});

describe("a task that is closed and current says what is next", () => {
  it("names the next period and its deadline", () => {
    render(<NextCycleNote cycle={note()} todayIso={TODAY} />);
    expect(screen.getByRole("heading", { name: "מה הלאה" })).toBeDefined();
    expect(screen.getByText(/ספטמבר–אוקטובר 2026/)).toBeDefined();
    expect(screen.getByText("15.11.2026")).toBeDefined();
  });

  it("says when the next renewal is, and that we will remind them", () => {
    render(
      <NextCycleNote
        cycle={note({ reason: "renewal", dueIso: "2027-01-10", periodLabel: null })}
        todayIso={TODAY}
      />
    );
    expect(screen.getByText("10.1.2027")).toBeDefined();
    expect(screen.getByText(/נזכיר לכם לפני/)).toBeDefined();
  });

  it("still gives a date for a period the engine could not name", () => {
    // A monthly 102 or an annual return has no bimonthly period, and labelling
    // one would be inventing a fact. The deadline is still the useful half.
    render(<NextCycleNote cycle={note({ periodLabel: null })} todayIso={TODAY} />);
    expect(screen.getByText("15.11.2026")).toBeDefined();
  });
});

describe("how far away it is, in Hebrew", () => {
  it("uses the dual and the named days rather than a number", () => {
    // "2 ימים" and "בעוד 1 ימים" are the translated-from-English texture the
    // product has been clearing out.
    expect(whenPhrase("2026-09-13", TODAY)).toBe("היום");
    expect(whenPhrase("2026-09-14", TODAY)).toBe("מחר");
    expect(whenPhrase("2026-09-15", TODAY)).toBe("מחרתיים");
    expect(whenPhrase("2026-09-16", TODAY)).toBe("בעוד 3 ימים");
    expect(whenPhrase("2026-09-12", TODAY)).toBe("באיחור יום");
    expect(whenPhrase("2026-09-11", TODAY)).toBe("באיחור יומיים");
  });
});
