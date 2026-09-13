import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The evidence pack may not restate a stored value under a name it does not
 * have.
 *
 * businesses.started_at is written as todayInIsrael() when onboarding
 * completes: it is the day the owner joined BizReady. Onboarding never asks
 * when the business itself started. The pack emitted it as "started_at" beside
 * dealer_number, vat_file and income_tax_file, where a reader takes it for the
 * business's start date — in a document produced to evidence compliance, next
 * to numbers that ARE what they say.
 *
 * The same column also tempted a fix in the other direction: recommendedDeadline
 * was a dead, tested function whose only available anchor was this column, and
 * wiring it would have dated every setup task from the signup day. It is
 * deleted for that reason.
 */
const route = readFileSync(
  join(process.cwd(), "src/app/api/evidence/export/route.ts"),
  "utf8"
);
const stripped = route
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

describe("the business block names what it actually holds", () => {
  it("does not present the signup date as a business start date", () => {
    expect(stripped).not.toMatch(/started_at:\s*business\.started_at/);
  });

  it("emits it as the span the record covers instead", () => {
    expect(stripped).toContain("tracking_since: business.started_at");
  });

  it("still emits it, rather than dropping the fact", () => {
    // The date is genuinely useful — it bounds what the log can cover. The
    // defect was the label, so the fix must not be deletion.
    expect(stripped).toContain("business.started_at");
  });
});

describe("nothing anchors a deadline to the signup date", () => {
  it("keeps recommendedDeadline deleted", () => {
    const compliance = readFileSync(join(process.cwd(), "src/lib/compliance.ts"), "utf8");
    expect(compliance).not.toMatch(/export function recommendedDeadline/);
  });

  it("and leaves started_at out of every dating path", () => {
    // buildPlan gives an active business no date at all; that is B5's fix. If
    // started_at ever reaches the plan builder, the invented dates are back.
    const engine = readFileSync(join(process.cwd(), "src/lib/rules-engine.ts"), "utf8");
    expect(engine).not.toContain("started_at");
  });
});
