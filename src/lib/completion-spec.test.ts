import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES } from "@/lib/content";
import { DEFAULT_COMPLETION, completionSpecOf } from "@/lib/types";

/**
 * WHICH FIELDS A TASK ASKS FOR MUST HAVE ONE ANSWER.
 *
 * Forty of the 73 templates used to declare no completion spec, so the flow
 * fell back to DEFAULT_COMPLETION. Three production sites each wrote
 * `completion ?? DEFAULT_COMPLETION` for themselves and happened to agree —
 * then the certificate was written, did not have that expression, read
 * `template.completion` directly, found nothing for those forty, and printed
 * the stored answer under the label `note`.
 *
 * All 73 now declare their own spec, which is a content rule held in
 * invariants.test.ts. The fallback stays because the next template is written
 * before its spec is — and it stays resolved in ONE place, which is this one.
 *
 * The defect was not a wrong fallback. It was a fourth reader of one rule.
 */
const root = process.cwd();
const SRC = join(root, "src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments explain the rule and would match the very shape being banned. */
function stripComments(text: string): string {
  const noBlock = text.replace(/\/\*[^]*?\*\//g, "");
  return noBlock
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/**
 * `.completion` read off something, but not `completion_data` and not
 * `completionSpecOf`. A negative lookahead rather than a word boundary, since
 * the receiver is usually an expression and not an identifier.
 */
const RAW_READ = /\.completion(?![_A-Za-z])/;

/** The fallback spelled out inline instead of asked for. */
const INLINE = /\?\?\s*DEFAULT_COMPLETION/;

/**
 * Every file allowed to touch `.completion` directly, each with its reason.
 * Anything else asks completionSpecOf.
 */
const ALLOWED = new Map([
  ["src/lib/types.ts", "declares the field, the default and the resolver"],
  [
    "src/lib/content/invariants.test.ts",
    "asserts that every template DECLARES a spec of its own — the one question the resolver cannot answer, since it returns the fallback either way",
  ],
  [
    "src/lib/completion-spec.test.ts",
    "the guard itself, which has to name the banned shapes in order to detect them",
  ],
  [
    "src/lib/certificate.test.ts",
    "names the old defect in prose, and picks a fixture by whether a spec is declared",
  ],
  [
    "src/components/task/task-experience.tsx",
    "reads .fields off the ALREADY-resolved spec handed to it as a prop, which happens to be named completion",
  ],
  [
    "src/components/task/milestone-tracker.test.tsx",
    "passes DEFAULT_COMPLETION in as a test fixture",
  ],
  [
    "src/components/task/task-experience.test.tsx",
    "passes DEFAULT_COMPLETION in as a test fixture",
  ],
]);

describe("the fallback is applied in exactly one place", () => {
  const files = sourceFiles(SRC).map((full) => ({
    rel: full.slice(root.length + 1).split("\\").join("/"),
    body: stripComments(readFileSync(full, "utf8")),
  }));

  it("the premise: the detectors see every shape that shipped", () => {
    // Each of these was really in this tree, so a pass below cannot be a
    // detector that matches nothing.
    expect(INLINE.test("const spec = completion ?? DEFAULT_COMPLETION;")).toBe(true);
    expect(RAW_READ.test("(template.completion?.fields ?? []).map((f) => f.key)")).toBe(true);
    expect(RAW_READ.test("completion: template.completion ?? DEFAULT_COMPLETION,")).toBe(true);
    // The one a receiver-anchored pattern let through: the first version of
    // the sweep below matched `template.completion` and `t.completion`, while
    // the live reader sat inside completeTask — the write path for every
    // artefact the certificate shows — one token outside the pattern.
    expect(
      RAW_READ.test("TEMPLATES_BY_ID.get(current.template_id)?.completion?.fields ?? []")
    ).toBe(true);
    // And neither may fire on the resolver or on the evidence column.
    expect(RAW_READ.test("completionSpecOf(template).fields")).toBe(false);
    expect(RAW_READ.test("task.completion_data ?? {}")).toBe(false);
    expect(INLINE.test("completionSpecOf(template)")).toBe(false);
  });

  it("no other file resolves it inline", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f.rel))
      .filter((f) => INLINE.test(f.body))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("and no other file reads .completion off a template instead of asking", () => {
    // Reading the raw field is the same defect in different clothes: it
    // silently returns undefined for a template with no spec of its own.
    const offenders = files
      .filter((f) => !ALLOWED.has(f.rel))
      .filter((f) => RAW_READ.test(f.body))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("the exemption is not stale, and every entry gives a reason", () => {
    const known = new Set(files.map((f) => f.rel));
    for (const [rel, reason] of ALLOWED) {
      expect(known.has(rel), rel + " is exempted but no longer exists").toBe(true);
      expect(reason.length, rel + " is exempted without a reason").toBeGreaterThan(10);
    }
  });
});

describe("what the resolver returns", () => {
  it("a template's own spec wins", () => {
    const withSpec = TASK_TEMPLATES.find((t) => (t.completion?.fields?.length ?? 0) > 0)!;
    expect(completionSpecOf(withSpec)).toBe(withSpec.completion);
  });

  it("a template with no spec gets the default, not undefined fields", () => {
    // Synthetic on purpose. Every shipped template now declares its own spec
    // (invariants.test.ts holds that line), so the fallback has no live
    // subject — and it must still behave, because the next template added is
    // written before its spec is.
    expect(completionSpecOf({})).toBe(DEFAULT_COMPLETION);
  });

  it("survives a missing template rather than throwing", () => {
    expect(completionSpecOf(null)).toBe(DEFAULT_COMPLETION);
    expect(completionSpecOf(undefined)).toBe(DEFAULT_COMPLETION);
  });

  it("every resolved spec asks for at least one answer", () => {
    // A spec with no fields would close a task on a tick alone and record
    // nothing — the certificate would then have nothing to show for it.
    for (const t of TASK_TEMPLATES) {
      const fields = completionSpecOf(t).fields ?? [];
      expect(fields.length, t.id).toBeGreaterThan(0);
    }
  });

  it("no field key collides within a template, or one would overwrite the other", () => {
    for (const t of TASK_TEMPLATES) {
      const keys = (completionSpecOf(t).fields ?? []).map((f) => f.key);
      expect(new Set(keys).size, t.id).toBe(keys.length);
    }
  });

  it("no field key starts with __, which the certificate strips as machine data", () => {
    for (const t of TASK_TEMPLATES) {
      for (const f of completionSpecOf(t).fields ?? []) {
        expect(f.key.startsWith("__"), t.id + "." + f.key).toBe(false);
      }
    }
  });
});
