import { describe, expect, it } from "vitest";
import {
  allChains,
  chainFor,
  checkBackDate,
  positionOf,
  stageIndexOf,
  statusForStage,
  waitingLabelFor,
} from "./milestones";
import { TASK_TEMPLATES } from "./index";

/**
 * The milestone chains, checked as data.
 *
 * A broken chain is not a cosmetic bug: the stage decides the task's status,
 * so a chain that ends on a non-terminal stage would leave a task permanently
 * unclosable, and a chain whose ids collide would place a task at the wrong
 * point in its own process.
 */
describe("every chain is well formed", () => {
  it("starts with the user holding the ball", () => {
    // A task cannot begin life waiting on someone else — nobody has handed
    // anything over yet.
    const bad = allChains()
      .filter(({ chain }) => chain[0]?.owner !== "you")
      .map(({ key, chain }) => `${key}: starts as ${chain[0]?.owner}`);
    expect(bad).toEqual([]);
  });

  it("ends on exactly one terminal stage, at the end", () => {
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      const terminals = chain.filter((s) => s.owner === "done");
      if (terminals.length !== 1) bad.push(`${key}: ${terminals.length} terminal stages`);
      else if (chain[chain.length - 1].owner !== "done") bad.push(`${key}: terminal is not last`);
    }
    expect(bad).toEqual([]);
  });

  it("gives every non-terminal stage a button that leaves it", () => {
    // Without an advance label the UI has nothing to render, and the task is
    // stuck at that stage with no way forward.
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      chain.forEach((s, i) => {
        const isLast = i === chain.length - 1;
        if (!isLast && !s.advance) bad.push(`${key}/${s.id}: no advance label`);
        if (isLast && s.advance) bad.push(`${key}/${s.id}: terminal stage has an advance label`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("has unique stage ids within a chain", () => {
    // Ids are stored in the database and resolved by findIndex, so a duplicate
    // silently places the task on the first match.
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      const seen = new Set<string>();
      for (const s of chain) {
        if (seen.has(s.id)) bad.push(`${key}: duplicate id "${s.id}"`);
        seen.add(s.id);
      }
    }
    expect(bad).toEqual([]);
  });

  it("only puts a reminder cadence on a stage that is actually a wait", () => {
    // checkBackDays drives "נזכיר לבדוק בעוד X". On a stage where the ball is
    // with the user, that reads as though someone else owes them something.
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      for (const s of chain) {
        if (s.checkBackDays != null && s.owner !== "them") {
          bad.push(`${key}/${s.id}: checkBackDays on an "${s.owner}" stage`);
        }
        if (s.checkBackDays != null && s.checkBackDays <= 0) {
          bad.push(`${key}/${s.id}: checkBackDays must be positive`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("never strands the user on a wait with no reminder", () => {
    // A "them" stage with no cadence is a task that goes quiet forever — the
    // exact failure the user described, where nothing tells you to look again.
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      for (const s of chain) {
        if (s.owner === "them" && !s.checkBackDays) bad.push(`${key}/${s.id}: wait with no cadence`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every shipped template a chain of at least two stages", () => {
    // One stage would mean "not started" and "done" are the same thing.
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      const chain = chainFor(t.id);
      if (!chain || chain.length < 2) bad.push(`${t.id}: ${chain?.length ?? 0} stages`);
    }
    expect(bad).toEqual([]);
  });
});

describe("the stage decides the status, in one direction", () => {
  it("maps a wait to waiting and a terminal to done", () => {
    const chain = chainFor("open-vat-file");
    expect(statusForStage(chain, 0)).toBe("todo");
    expect(statusForStage(chain, 1)).toBe("in_progress");
    expect(statusForStage(chain, 2)).toBe("waiting");
    expect(statusForStage(chain, chain.length - 1)).toBe("done");
  });

  it("produces a status for every stage of every chain", () => {
    // Totality matters: a stage with no status mapping would render a task the
    // engines cannot score.
    const allowed = new Set(["todo", "in_progress", "waiting", "done"]);
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      chain.forEach((s, i) => {
        const status = statusForStage(chain, i);
        if (!allowed.has(status)) bad.push(`${key}/${s.id} -> ${status}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("refuses to read an out-of-range index as progress", () => {
    expect(statusForStage(chainFor("open-vat-file"), 99)).toBe("todo");
  });
});

describe("placing a task that has no stored stage", () => {
  // Every task that existed before this feature is in exactly this position.
  const chain = chainFor("open-vat-file");

  it("puts a legacy todo at the start", () => {
    expect(stageIndexOf({ status: "todo" }, chain)).toBe(0);
  });

  it("puts a legacy done at the end", () => {
    expect(stageIndexOf({ status: "done" }, chain)).toBe(chain.length - 1);
  });

  it("puts a legacy waiting on the first real wait", () => {
    const i = stageIndexOf({ status: "waiting" }, chain);
    expect(chain[i].owner).toBe("them");
  });

  it("understates rather than overstates in-progress", () => {
    // The stored status cannot say how far in you are, and claiming more
    // progress than the user has made is the worse error here.
    const i = stageIndexOf({ status: "in_progress" }, chain);
    expect(i).toBeLessThan(chain.length - 1);
    expect(chain[i].owner).toBe("you");
  });

  it("does not treat a legacy waiting as done when the chain has no wait", () => {
    // calculator chains are two stages with no external hand-off.
    const flat = chainFor("__no_such_template__");
    const i = stageIndexOf({ status: "waiting" }, flat);
    expect(flat[i].owner).not.toBe("done");
  });

  it("ignores a stored stage id that is not in the chain any more", () => {
    // If a chain is ever re-authored, orphaned rows must fall back rather than
    // land on stage 0 by accident of findIndex returning -1.
    const i = stageIndexOf({ stage: "stage_that_was_renamed", status: "waiting" }, chain);
    expect(chain[i].owner).toBe("them");
  });

  it("never renders a finished task as still waiting", () => {
    // completeTask and the stage column are two writes. If they disagree — an
    // older row closed through the evidence flow before this feature, say —
    // the task must not keep claiming it is waiting on an authority, because
    // "done" is what the score, journey, compliance and reminder engines all
    // read. So a done status beats a stale stage.
    const p = positionOf({
      template_id: "open-vat-file",
      stage: "awaiting_certificate",
      status: "done",
    });
    expect(p.stage.owner).toBe("done");
    expect(p.next).toBeNull();
  });

  it("prefers the stored stage when it resolves", () => {
    const p = positionOf({ template_id: "open-vat-file", stage: "submit", status: "todo" });
    expect(p.stage.id).toBe("submit");
    expect(p.resolvedFromStage).toBe(true);
  });

  it("says when it had to guess", () => {
    const p = positionOf({ template_id: "open-vat-file", status: "waiting" });
    expect(p.resolvedFromStage).toBe(false);
  });
});

describe("what the user is told they are waiting for", () => {
  it("names the specific thing, not 'a third party'", () => {
    const label = waitingLabelFor({
      template_id: "open-vat-file",
      stage: "awaiting_certificate",
      status: "waiting",
    });
    expect(label).toBe("ממתין לתעודת עוסק");
    expect(label).not.toContain("גורם חיצוני");
  });

  it("distinguishes two different waits inside one task", () => {
    // business-license has an inspection wait and a licence wait. A single
    // "waiting" status could never tell them apart, which is the whole point.
    const inspection = waitingLabelFor({
      template_id: "business-license",
      stage: "awaiting_inspection",
      status: "waiting",
    });
    const licence = waitingLabelFor({
      template_id: "business-license",
      stage: "awaiting_license",
      status: "waiting",
    });
    expect(inspection).not.toBe(licence);
  });

  it("never shows the old generic wording anywhere in the registry", () => {
    const bad: string[] = [];
    for (const { key, chain } of allChains()) {
      for (const s of chain) {
        if (/גורם חיצוני|בתהליך$/.test(s.label)) bad.push(`${key}/${s.id}: "${s.label}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("the follow-up date is derived, not typed", () => {
  it("adds the cadence to today", () => {
    const chain = chainFor("open-vat-file");
    const wait = chain.find((s) => s.owner === "them")!;
    expect(wait.checkBackDays).toBe(5);
    expect(checkBackDate(wait, "2026-09-12")).toBe("2026-09-17");
  });

  it("crosses a month boundary correctly", () => {
    const chain = chainFor("business-license");
    const inspection = chain.find((s) => s.id === "awaiting_inspection")!;
    expect(checkBackDate(inspection, "2026-09-12")).toBe("2026-10-12");
  });

  it("sets nothing on a stage where the ball is with the user", () => {
    const chain = chainFor("open-vat-file");
    expect(checkBackDate(chain[0], "2026-09-12")).toBeNull();
  });

  it("returns null rather than an Invalid Date string", () => {
    const wait = chainFor("open-vat-file").find((s) => s.owner === "them")!;
    expect(checkBackDate(wait, "not-a-date")).toBeNull();
  });
});

describe("advancing hands the last step to the evidence flow", () => {
  it("flags the advance that completes the task", () => {
    const chain = chainFor("open-vat-file");
    const beforeLast = positionOf({
      template_id: "open-vat-file",
      stage: chain[chain.length - 2].id,
      status: "waiting",
    });
    expect(beforeLast.advanceCompletes).toBe(true);
  });

  it("does not flag an earlier advance", () => {
    const p = positionOf({ template_id: "open-vat-file", stage: "prepare", status: "todo" });
    expect(p.advanceCompletes).toBe(false);
  });

  it("has no next stage at the end", () => {
    const chain = chainFor("open-vat-file");
    const p = positionOf({
      template_id: "open-vat-file",
      stage: chain[chain.length - 1].id,
      status: "done",
    });
    expect(p.next).toBeNull();
    expect(p.advanceCompletes).toBe(false);
  });
});
