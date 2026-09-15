import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY WAY A TASK CAN BE CLOSED MUST LEAVE A RECORD BEHIND.
 *
 * There are four, and only one of them recorded anything:
 *
 *   completeTask        the full flow — asks for the template's fields
 *   completeOnboarding  "מה כבר יש?" in the registration wizard
 *   applyCatchUp        the same assertion, made later
 *   updateAnswers       a profile correction that makes an already-ticked
 *                       task applicable, so it arrives already closed
 *
 * The middle two closed the task and wrote no artefact. All 17 options the
 * wizard offers close a task whose spec declares a required answer, and 13 of
 * them declare a `writesTo` that fills a business-card column — so a brand-new
 * user who truthfully ticked "פתחתי תיק עוסק במע״מ" landed on a card where the
 * task read done, `dealer_number` was empty, the completeness checklist said
 * the number was missing, and the certificate said the task had been completed
 * with nothing recorded. Four surfaces, one fact, four stories — and no screen
 * could have been fixed to resolve it, because the fact was never collected.
 *
 * The fourth was found by this sweep, not by reading the code: it inserted a
 * DONE task with no completed_at and no task_events row at all — the same
 * defect completeOnboarding had been fixed for one session earlier.
 *
 * The sweep is function-scoped on purpose rather than clever. It cannot prove
 * two writes sit in one statement — that is what review is for. It CAN prove
 * that a fifth close path does not arrive recording nothing.
 */
const root = process.cwd();
const SRC = join(root, "src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * The body of each top-level `export async function`, by name.
 *
 * Brace-walked from the signature rather than sliced to a fixed length: a
 * fixed window breaks the moment a comment above the code grows, which has
 * hollowed out a guard in this codebase before.
 *
 * The body's opening brace is the first one at ANGLE-bracket depth zero. The
 * first version took `indexOf("{")` after the parameter list and so captured
 * `{ done: number; handled: number }` out of
 * `Promise<{ done: number; ... }>` — applyCatchUp's return type — reporting
 * that applyCatchUp does not close a task. Reading the wrong text is the
 * quietest way for a sweep to certify what it is meant to catch.
 */
function exportedFunctions(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const marker = "export async function ";
  let at = text.indexOf(marker);

  while (at !== -1) {
    const nameStart = at + marker.length;
    const parenAt = text.indexOf("(", nameStart);
    const name = text.slice(nameStart, parenAt).trim();

    // Past the parameter list.
    let i = parenAt;
    let paren = 0;
    for (; i < text.length; i++) {
      if (text[i] === "(") paren++;
      else if (text[i] === ")") {
        paren--;
        if (paren === 0) break;
      }
    }

    // Then the body's brace: the first `{` outside any generic argument.
    let angle = 0;
    let bodyStart = -1;
    for (i++; i < text.length; i++) {
      const c = text[i];
      if (c === "<") angle++;
      else if (c === ">") angle = Math.max(0, angle - 1);
      else if (c === "{" && angle === 0) {
        bodyStart = i;
        break;
      }
    }
    if (bodyStart === -1) break;

    let depth = 0;
    let end = bodyStart;
    for (i = bodyStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    out.set(name, text.slice(bodyStart, end + 1));
    at = text.indexOf(marker, end);
  }
  return out;
}

/** Closes a task: writes done to business_tasks, or inserts a plan that can. */
function closesATask(body: string): boolean {
  if (!body.includes("business_tasks")) return false;
  return body.includes('status: "done"') || body.includes("status: t.status");
}

/**
 * Each close path and whether it has anywhere to ASK for the artefact.
 *
 * The distinction is the honest part. Three of the four put a field in front
 * of the user at the moment they assert the work is done. The fourth is a
 * settings form correcting the profile, which has no such moment — so it must
 * still record the completion in the trail, and the certificate names the task
 * as having recorded nothing, with a link to add the detail later.
 */
const CLOSE_PATHS = new Map([
  ["completeTask", { collects: true, reason: "the completion flow itself" }],
  ["completeOnboarding", { collects: true, reason: "asks beside each box ticked in מה כבר יש" }],
  ["applyCatchUp", { collects: true, reason: "asks beside each row marked עשיתי" }],
  [
    "updateAnswers",
    {
      collects: false,
      reason:
        "a profile correction, with no moment to ask: it records the completion in the trail and the certificate names the task as missing its artefact",
    },
  ],
]);

describe("the ways a task can be closed", () => {
  const files = sourceFiles(SRC).map((full) => ({
    rel: full.slice(root.length + 1).split("\\").join("/"),
    text: readFileSync(full, "utf8"),
  }));
  const functions = new Map<string, { rel: string; body: string }>();
  for (const f of files) {
    for (const [name, body] of exportedFunctions(f.text)) {
      functions.set(name, { rel: f.rel, body });
    }
  }

  it("the premise: the parser really reads each one's body", () => {
    // A sweep that parsed nothing, or parsed a return type, would pass every
    // assertion below. Both have happened.
    for (const name of CLOSE_PATHS.keys()) {
      const fn = functions.get(name);
      expect(fn, name + " was not parsed out of the source").toBeTruthy();
      expect(closesATask(fn!.body), name + " no longer closes a task").toBe(true);
    }
    // And the shape that fooled the first version stays fooled no longer.
    expect(functions.get("applyCatchUp")!.body).toContain("business_tasks");
  });

  it("are exactly the four named here", () => {
    const found = [...functions]
      .filter(([, f]) => closesATask(f.body))
      .map(([name]) => name)
      .sort();
    // A fifth arriving is not a failure to fix by editing this list: it is a
    // path that has to record its completion before it ships.
    expect(found).toEqual([...CLOSE_PATHS.keys()].sort());
  });

  it("every one of them writes the COMPLETION into the trail", () => {
    // The trail is hash-chained, so a completion missing from it is missing
    // permanently. updateAnswers inserted done tasks and wrote no event at all.
    //
    // Both halves matter. Asking only whether the body mentions task_events
    // passed with the completion event deleted, because updateAnswers writes
    // status_change events for the tasks it hides and restores — a function
    // can be busily trailing everything EXCEPT the thing that needs trailing.
    const silent = [...CLOSE_PATHS.keys()].filter((n) => {
      const body = functions.get(n)!.body;
      return !body.includes("task_events") || !body.includes('"completed"');
    });
    expect(silent).toEqual([]);
  });

  it("every one of them dates the completion it creates", () => {
    // A done row with completed_at null has no answer to "when did this
    // happen" — on the trail, the filing history, or the certificate.
    const undated = [...CLOSE_PATHS.keys()].filter(
      (n) => !functions.get(n)!.body.includes("completed_at")
    );
    expect(undated).toEqual([]);
  });

  it("the ones that can ask for an artefact record it on the task", () => {
    const silent = [...CLOSE_PATHS]
      .filter(([, v]) => v.collects)
      .filter(([n]) => !functions.get(n)!.body.includes("completion_data"))
      .map(([n]) => n);
    expect(silent).toEqual([]);
  });

  it("and ask task-evidence which card column may receive it", () => {
    // Never an inline allowlist. completeTask's was computed from a SEPARATE
    // argument the client sent, so the browser chose which answer went into
    // which column and the server checked only that the column was one this
    // template may write.
    const freelancing = [...CLOSE_PATHS]
      .filter(([, v]) => v.collects)
      .filter(([n]) => !functions.get(n)!.body.includes("cardWritesFor"))
      .map(([n]) => n);
    expect(freelancing).toEqual([]);
  });

  it("no close path maps answers to columns by hand", () => {
    const byHand = [...CLOSE_PATHS.keys()].filter((n) =>
      /\.map\(\(f\) => f\.writesTo\)/.test(functions.get(n)!.body)
    );
    expect(byHand).toEqual([]);
  });

  it("the premise: the by-hand detector sees the shape that shipped", () => {
    const shipped = "(spec.fields ?? []).map((f) => f.writesTo).filter(Boolean)";
    expect(/\.map\(\(f\) => f\.writesTo\)/.test(shipped)).toBe(true);
  });

  it("every path that cannot collect says why", () => {
    for (const [name, v] of CLOSE_PATHS) {
      if (v.collects) continue;
      expect(v.reason.length, name + " opts out without a reason").toBeGreaterThan(20);
    }
  });
});
