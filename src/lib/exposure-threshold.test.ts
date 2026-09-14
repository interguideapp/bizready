import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPOSURE_THRESHOLD,
  exposureOf,
  significantExposures,
  topExposure,
} from "@/lib/exposure";
import { computeUpcomingObligations, type ComplianceTask } from "@/lib/compliance";
import { TEMPLATES_BY_ID } from "@/lib/content";

/**
 * A HEADING THAT CLAIMS CONSEQUENCE MAY ONLY LIST THINGS THAT CARRY IT.
 *
 * topExposure has carried the threshold since it was written, with the reason
 * spelled out in its docstring: returning nothing "is a legitimate and honest
 * answer, and better than promoting the least-irrelevant item to look busy".
 * It was called by no production code at all.
 *
 * What the two surfaces did instead was rank and slice. Home takes four under
 * "מה באמת עלול לעלות לכם", beside a warning triangle — and "באמת" makes that
 * a stronger claim than a neutral list. Insights takes three under "מה הכי
 * כדאי לטפל בו", filtered only by proximity. So a business whose every
 * obligation is advisory still got rows asserting material cost.
 *
 * Both sections already disappear when handed nothing, so the honest
 * behaviour needed only the filter they were missing.
 */
const TODAY = new Date("2026-09-14T09:00:00Z");

function task(over: Partial<ComplianceTask>): ComplianceTask {
  return {
    template_id: "vat-reporting",
    status: "todo",
    is_relevant: true,
    completed_at: null,
    dismissal: null,
    completion_data: null,
    due_date: null,
    filed_periods: [],
    ...over,
  } as ComplianceTask;
}

/** A distant document expiry: real, dated, and not something that "costs". */
function advisoryOnly() {
  return computeUpcomingObligations(
    [],
    TEMPLATES_BY_ID,
    [{ name: "תעודת ביטוח", expires_at: "2027-06-01" }],
    TODAY,
    { entityType: "osek_patur" }
  );
}

/** A VAT filing already late: penalty and interest accruing. */
function realExposure() {
  return computeUpcomingObligations(
    [
      task({ template_id: "open-vat-file", status: "done", completed_at: "2026-01-05T09:00:00Z" }),
      task({ template_id: "vat-reporting", due_date: "2026-07-15" }),
    ],
    TEMPLATES_BY_ID,
    [],
    TODAY,
    { entityType: "osek_murshe", vatFrequency: "bimonthly" }
  );
}

describe("the threshold separates the two", () => {
  it("the premise: both fixtures produce obligations at all", () => {
    // Either being empty would make every assertion below vacuous.
    expect(advisoryOnly().length).toBeGreaterThan(0);
    expect(realExposure().length).toBeGreaterThan(0);
  });

  it("a late statutory filing is above it", () => {
    const scores = realExposure().map((o) => exposureOf(o).score);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(EXPOSURE_THRESHOLD);
    expect(significantExposures(realExposure(), 4).length).toBeGreaterThan(0);
  });

  it("a distant advisory expiry is below it, so nothing is claimed", () => {
    // The case the heading was lying about.
    expect(significantExposures(advisoryOnly(), 4)).toEqual([]);
  });

  it("topExposure and significantExposures use the same cut", () => {
    // Two functions, one threshold: they were a default parameter and a
    // literal before, which is how the pair that drifted this session began.
    expect(topExposure(advisoryOnly())).toBeNull();
    expect(significantExposures(advisoryOnly(), 1)).toEqual([]);
    expect(topExposure(realExposure())).not.toBeNull();
  });

  it("respects the limit, and ranks before cutting", () => {
    const all = significantExposures(realExposure(), 1);
    expect(all.length).toBeLessThanOrEqual(1);
    const full = significantExposures(realExposure(), 10);
    if (full.length > 1) {
      expect(full[0].score).toBeGreaterThanOrEqual(full[1].score);
      expect(all[0].obligationId).toBe(full[0].obligationId);
    }
  });
});

describe("both surfaces apply it", () => {
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it("home filters before taking four", () => {
    const page = read("src/app/(app)/home/page.tsx");
    expect(page).toContain("significantExposures(actionable, 4)");
    // The shape that claimed consequence for anything it happened to rank.
    expect(page).not.toContain("rankByExposure(actionable).slice");
  });

  it("insights filters as well as looking 30 days ahead", () => {
    const page = read("src/app/(app)/insights/page.tsx");
    expect(page).toContain("significantExposures(actionable, 3)");
    expect(page).not.toMatch(/rankByExposure\(actionable\)\s*$/m);
  });

  it("the headings that make the claim are still there", () => {
    // If the copy were softened instead, the filter would be pointless — and
    // the claim is a good one to make when it is true.
    expect(read("src/components/home/home-os.tsx")).toContain("מה באמת עלול לעלות לכם");
    expect(read("src/components/insights/lead.tsx")).toContain("מה הכי כדאי לטפל בו");
  });
});
