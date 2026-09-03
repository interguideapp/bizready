import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { buildJourney, type JourneyTask } from "./journey";

function jt(template_id: string, status: JourneyTask["status"]): JourneyTask {
  return { template_id, status, is_relevant: true };
}

describe("buildJourney", () => {
  it("locks a task whose dependency isn't done, and unlocks it once the dep is done", () => {
    // open-income-tax-file depends_on ["open-vat-file"]
    const locked = buildJourney(
      [jt("open-vat-file", "todo"), jt("open-income-tax-file", "todo")],
      TEMPLATES_BY_ID
    );
    expect(locked.byId.get("open-income-tax-file")!.state).toBe("locked");
    expect(locked.byId.get("open-income-tax-file")!.blockedBy.length).toBeGreaterThan(0);

    const unlocked = buildJourney(
      [jt("open-vat-file", "done"), jt("open-income-tax-file", "todo")],
      TEMPLATES_BY_ID
    );
    // now available (and possibly picked as "next")
    expect(["available", "next"]).toContain(
      unlocked.byId.get("open-income-tax-file")!.state
    );
  });

  it("marks a dependency's unlocks", () => {
    const j = buildJourney(
      [jt("open-vat-file", "todo"), jt("open-income-tax-file", "todo")],
      TEMPLATES_BY_ID
    );
    expect(j.byId.get("open-vat-file")!.unlocks).toContain("open-income-tax-file");
  });

  it("picks a single next best move among available tasks", () => {
    const j = buildJourney([jt("open-vat-file", "todo")], TEMPLATES_BY_ID);
    expect(j.nextTemplateId).toBe("open-vat-file");
    expect(j.byId.get("open-vat-file")!.state).toBe("next");
  });
});
