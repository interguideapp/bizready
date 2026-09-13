import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The catch-up pass has to be reachable, and its refusal has to be enforced
 * on the server.
 *
 * Both halves are invisible to every other test. A correct engine that no
 * screen links to is the shape this codebase has produced repeatedly —
 * getSyncErrors with finished UI nobody imported, computeForecast tested and
 * never called, recommendedDeadline exported and dead. And a refusal enforced
 * only in the list the page renders is not a refusal: a Server Action is a
 * public POST endpoint, so the ids arrive from a browser.
 */
const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

describe("the questionnaire is reachable", () => {
  it("from settings, next to the answers it complements", () => {
    // SettingsForm changes what APPLIES; this records what is already DONE.
    // Only the first was reachable after onboarding.
    const page = read("src/app/(app)/settings/page.tsx");
    expect(page).toContain('href="/catch-up"');
  });

  it("from plan-ready, where an existing business first sees its full plan", () => {
    // Someone trading for three years otherwise starts with a plan saying they
    // have done none of it.
    expect(read("src/app/plan-ready/page.tsx")).toContain('href="/catch-up"');
  });

  it("and the route itself exists and renders the form", () => {
    const page = read("src/app/(app)/catch-up/page.tsx");
    expect(page).toContain("<CatchUpForm");
    expect(page).toContain("catchUpItems(tasks, TEMPLATES_BY_ID)");
  });
});

describe("the statutory refusal is enforced where it counts", () => {
  const actions = read("src/lib/actions.ts");

  it("the action filters through acceptableMarks, not the payload", () => {
    expect(actions).toContain("acceptableMarks(");
  });

  it("it checks against this business's own plan", () => {
    // Not against the submitted list, and not against all templates: the ids
    // arrive from a browser.
    const at = actions.indexOf("export async function applyCatchUp");
    expect(at).toBeGreaterThan(-1);
    const fn = actions.slice(at, actions.indexOf("revalidatePath", at));
    expect(fn).toContain('.from("business_tasks")');
    expect(fn).toContain('.eq("business_id", business.id)');
    expect(fn).toContain("acceptableMarks(");
  });

  it("caps the submission, so one request cannot drive an unbounded loop", () => {
    expect(actions).toContain("submitted.slice(0, 200)");
  });

  it("records which pass the change came from", () => {
    // The trail must distinguish this from the task's own completion flow:
    // that one captured documents, this is the owner's recollection.
    expect(actions).toContain('via: "catch-up"');
  });

  it("revalidates everything, since every surface derives from the task set", () => {
    const at = actions.indexOf("export async function applyCatchUp");
    expect(actions.slice(at)).toContain('revalidatePath("/", "layout")');
  });
});

describe("the page says what it is holding back", () => {
  it("lists the statutory filings instead of omitting them", () => {
    // An omission reads as "does not apply to you", and these carry penalties.
    const page = read("src/app/(app)/catch-up/page.tsx");
    expect(page).toContain("statutoryHeldBack(tasks, TEMPLATES_BY_ID)");
    expect(page).toMatch(/חובות הגשה לא מופיעות כאן|חובת הגשה אחת לא מופיעה כאן/);
  });

  it("gives the real reason, which is the evidence trail", () => {
    expect(read("src/app/(app)/catch-up/page.tsx")).toMatch(/ראיה|אסמכתא/);
  });
});
