import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeAnswers } from "@/lib/validate-answers";
import type { OnboardingAnswers } from "@/lib/types";

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

/** A full answer set, so the sanitiser is not defaulting a missing field. */
const ANSWERS: OnboardingAnswers = {
  stage: "active",
  entity_type: "osek_patur",
  field: "beauty_care",
  expected_revenue: "60k_to_ceiling",
  work_location: "home",
  sales_channel: "in_person",
  client_type: "private",
  product_type: "services",
  hosts_clients: true,
  collects_personal_data: true,
  uses_vehicle: false,
  has_website: false,
  plans_employees: false,
  employee_work_mode: "on_site",
  wants_marketing: true,
  already_done: [],
};

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

describe("it is not offered to a role that cannot use it", () => {
  /**
   * Verified against the live policies, not assumed: business_tasks UPDATE
   * requires can_edit_business() or ownership, so a viewer's write is rejected
   * by RLS and the form would have silently done nothing while reporting
   * "nothing to update". Offering a questionnaire that refuses every answer is
   * the same defect as any other promise the product cannot keep — and it is
   * the one this whole session has been about.
   */
  const page = read("src/app/(app)/catch-up/page.tsx");

  it("reads the role rather than just the business", () => {
    expect(page).toContain("requireBusinessContext()");
    expect(page).toContain("capabilitiesFor(role).completeTasks");
  });

  it("shows a viewer why, instead of a form that will refuse them", () => {
    expect(page).toContain("!canEdit ?");
    expect(page).toMatch(/גישת צפייה/);
  });

  it("checks the capability before the empty-state branch", () => {
    // Otherwise a viewer with nothing offerable gets "אין מה לרענן" — true by
    // accident and misleading about why.
    expect(page.indexOf("!canEdit ?")).toBeLessThan(page.indexOf("groups.length === 0"));
  });

  it("uses the same capability the board uses for the same action", () => {
    // completeTasks, not a new one: closing a task from here and closing it
    // from the obligations board are the same permission.
    expect(read("src/app/(app)/calendar/page.tsx")).toContain(
      "capabilitiesFor(role).completeTasks"
    );
  });
});

describe("a refused write is reported as refused", () => {
  it("the action distinguishes it from nothing-to-do", () => {
    // A role can change between the render and the submit, so the page's gate
    // is not the only thing standing here.
    const actions = read("src/lib/actions.ts");
    expect(actions).toContain("refused: accepted.length - done - handled");
    expect(actions).toContain("attempted: accepted.length");
  });

  it("the form says so rather than 'nothing to update'", () => {
    const form = read("src/app/(app)/catch-up/catch-up-form.tsx");
    expect(form).toContain("res.attempted > 0 && res.done === 0 && res.handled === 0");
    expect(form).toMatch(/העדכון נדחה/);
  });
});

/** Reuses the read() helper above rather than repeating the stripper. */
const nudge = read("src/app/(app)/home/catch-up-nudge.tsx");

describe("the product offers the pass instead of waiting to be found", () => {
  /**
   * Settings and /plan-ready are both places nobody returns to, so an owner who
   * signed up months ago would never find the questionnaire — while the product
   * could usually tell it was needed. Staying quiet was a choice, not a limit.
   */
  it("home asks the question when the picture is probably stale", () => {
    /*
     * The exact assignment, not the presence of the name. My first version
     * asserted both separately and PASSED against a planted
     * `suggestCatchUp: false && looksLikeCatchUpNeeded({...})` — the same hole
     * a `autoSyncRunning = true` plant found earlier today. The presence of a
     * call says nothing about whether its answer is used.
     */
    const page = read("src/app/(app)/home/page.tsx");
    expect(page).toContain("suggestCatchUp: looksLikeCatchUpNeeded({");
    /*
     * And the STORED tasks, not the cycle-projected ones. projectCycles
     * rewrites a reopened task to status "todo" AND completed_at null — right
     * for every screen asking "what is open now", wrong for the only question
     * this asks. Fed the projected list, an owner whose single closed task was
     * a recurring one that came round again reads as never having engaged and
     * is asked on every home visit.
     *
     * Asserted because I planted exactly that and the predicate's own tests
     * stayed green: the fix has two halves and they live in different files.
     */
    const at = page.indexOf("looksLikeCatchUpNeeded({");
    const call = page.slice(at, page.indexOf("})", at));
    expect(call, "home feeds the projected task list").toContain(
      "tasks: await getBusinessTasks(business.id)"
    );
  });

  it("and the card links to the questionnaire", () => {
    // The copy lives in its own component now, and these three assertions
    // caught that extraction — which is what they are for.
    expect(read("src/components/home/home-os.tsx")).toContain("data.suggestCatchUp &&");
    expect(nudge).toContain('href="/catch-up"');
  });

  it("phrases it as a question, not as an assertion about their records", () => {
    /**
     * The inference can be wrong: a genuinely new owner who described the
     * business as active has simply done nothing yet, and telling them their
     * records are stale would be false. Every other notice in this codebase
     * earned its wording the same way.
     */
    expect(nudge).toContain("כבר טיפלתם בחלק מזה?");
    expect(nudge).toMatch(/אם חלק מזה/);
    // It must not claim they HAVE done things, only ask.
    expect(nudge).not.toMatch(/הרשומות שלכם לא מעודכנות|כבר עשיתם/);
  });

  it("states the ground it stands on, so the ask is checkable", () => {
    // "marked active, nothing closed" is a fact the reader can verify, which
    // is what keeps a guess from reading like a guess.
    expect(nudge).toMatch(/מוגדר כפעיל/);
  });

  it("offers a way to answer NO", () => {
    /**
     * The first version had none, so an owner who really has just started
     * would have been asked again on every visit to the home screen, forever.
     * An unanswerable question is an alarm with no off switch, and this
     * session removed two of those before noticing it had built a third.
     */
    expect(nudge).toMatch(/לא, העסק עוד בהקמה/);
  });

  it("treats NO as a correction, not as hiding the card", () => {
    // If nothing has been done the business is not yet active, so the answer
    // that resolves the contradiction is the stage itself — which also fills
    // in the recommended dates it should have had.
    expect(nudge).toContain('setBusinessStage("setting_up")');
  });

  it("the correction reuses the recalibration path", () => {
    // A second writer of the stage answer would drift from the sanitising,
    // the reconcile, the re-dating and the statutory re-anchor.
    const actions = read("src/lib/actions.ts");
    const at = actions.indexOf("export async function setBusinessStage");
    expect(at).toBeGreaterThan(-1);
    const fn = actions.slice(at, at + 1200);
    expect(fn).toContain("return updateAnswers({ ...current, stage });");
    // And it must not trust the client with the rest of the answers.
    expect(fn).toContain('.select("onboarding_answers")');
  });

  it("validates the stage instead of writing whatever arrives", () => {
    const actions = read("src/lib/actions.ts");
    const at = actions.indexOf("export async function setBusinessStage");
    expect(actions.slice(at, at + 700)).toContain(
      'stage !== "idea" && stage !== "setting_up" && stage !== "active"'
    );
  });
});

describe("the delegation actually sticks", () => {
  /**
   * setBusinessStage does not write the column; it hands the merged answers to
   * updateAnswers. That is the right shape — one writer for a field that gates
   * which templates apply and whether recommended dates exist — but it means
   * the correction survives only if the sanitiser preserves it and the path
   * revalidates. Both are somebody else's code, and "delegated to code that
   * drops it on the floor" is the same as not written at all.
   */
  it("the sanitiser keeps every stage it is given", () => {
    for (const stage of ["idea", "setting_up", "active"] as const) {
      expect(sanitizeAnswers({ ...ANSWERS, stage }).stage, stage).toBe(stage);
    }
  });

  it("and refuses one it does not recognise, rather than storing it", () => {
    // The action validates first, so this is the second line rather than the
    // first — but a field this load-bearing should not depend on one check.
    const out = sanitizeAnswers({ ...ANSWERS, stage: "trading" as never });
    expect(["idea", "setting_up", "active"]).toContain(out.stage);
  });

  it("updateAnswers revalidates, so the card clears without a reload", () => {
    // Otherwise answering "no" would appear to do nothing and the question
    // would still be on screen — which is how it looked before it had a "no".
    const actions = read("src/lib/actions.ts");
    const at = actions.indexOf("export async function updateAnswers");
    const end = actions.indexOf("export async function", at + 10);
    expect(actions.slice(at, end)).toContain('revalidatePath("/", "layout")');
  });
});
