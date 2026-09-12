// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OverdueBanner, TopExposures, type ExposureView } from "./lead";

/**
 * What תובנות opens with.
 *
 * The page led with the readiness score, which can sit at 95 while a statutory
 * filing is overdue — a filing handed to the accountant counts as "waiting" and
 * earns half credit. These assertions exist so the page cannot drift back to
 * greeting someone with a comfortable number while interest accrues.
 */
afterEach(cleanup);

function exposure(over: Partial<ExposureView> = {}): ExposureView {
  return {
    obligationId: "a",
    templateId: "vat-reporting",
    title: 'דיווח מע"מ תקופתי',
    daysUntil: -5,
    basis: "statutory" as const,
    severity: "penalty_accruing",
    consequence: "איחור בדיווח ובתשלום צובר ריבית והצמדה מהיום הראשון.",
    ...over,
  };
}

describe("the overdue banner", () => {
  it("says outright that the score does not tell the whole story", () => {
    // The specific false comfort this replaces.
    render(<OverdueBanner count={2} />);
    expect(screen.getByText(/הציון למטה לא מספר את כל הסיפור/)).toBeDefined();
  });

  it("uses the singular for one", () => {
    render(<OverdueBanner count={1} />);
    expect(screen.getByRole("heading", { name: /חובה חוקית אחת עברה את המועד/ })).toBeDefined();
  });

  it("renders nothing when nothing is overdue", () => {
    const { container } = render(<OverdueBanner count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("offers the way to the board", () => {
    render(<OverdueBanner count={1} />);
    expect(screen.getByRole("link", { name: /ללוח החובות/ })).toBeDefined();
  });
});

describe("what is most worth doing", () => {
  it("says it is ranked by consequence, not by date", () => {
    // Otherwise a reader assumes the top item is simply the soonest.
    render(<TopExposures exposures={[exposure()]} />);
    expect(screen.getByText(/מדורג לפי מה שקורה אם מתעלמים/)).toBeDefined();
  });

  it("carries the severity and the consequence on every row", () => {
    render(<TopExposures exposures={[exposure()]} />);
    expect(screen.getByText("קנס שמצטבר")).toBeDefined();
    expect(screen.getByText(/צובר ריבית והצמדה/)).toBeDefined();
  });

  it("keeps a blocking item above an advisory one that is due sooner", () => {
    // The whole point of consequence-ranking: a licence 12 days out outranks a
    // tax benefit due today, because one closes the business.
    render(
      <TopExposures
        exposures={[
          exposure({ obligationId: "b", title: "רישיון עסק", daysUntil: 12, severity: "blocking" }),
          exposure({ obligationId: "c", title: "קרן השתלמות", daysUntil: 0, severity: "advisory" }),
        ]}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("רישיון עסק");
  });

  it("shows how late an overdue item is, not just that it is", () => {
    render(<TopExposures exposures={[exposure({ daysUntil: -5 })] } />);
    expect(screen.getByText("באיחור 5 ימים")).toBeDefined();
  });

  it("renders nothing when there is nothing pressing", () => {
    // An empty "what is most worth doing" card is worse than no card: it
    // promotes the least irrelevant item to look busy.
    const { container } = render(<TopExposures exposures={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("insights words a passed date by what it is", () => {
  it("says 'באיחור' about a statutory filing", () => {
    render(<TopExposures exposures={[exposure({ daysUntil: -95 })]} />);
    expect(screen.getByText("באיחור כ-3 חודשים")).toBeDefined();
  });

  it("does not say 'באיחור' about a cover that ran out", () => {
    // Same overclaim the obligations board carried: "באיחור" asserts a missed
    // deadline, and an expired policy missed none.
    render(
      <TopExposures
        exposures={[
          exposure({
            daysUntil: -95,
            basis: "renewal",
            templateId: "professional-liability-insurance",
            title: "חידוש: ביטוח אחריות מקצועית",
            severity: "advisory",
          }),
        ]}
      />
    );
    expect(screen.queryByText(/באיחור/)).toBeNull();
    expect(screen.getByText("פג לפני כ-3 חודשים")).toBeDefined();
  });
});
