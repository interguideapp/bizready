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
 * Where the fallback legitimately lives, and the tests that name it as the
 * thing being asserted rather than applying it.
 */
const ALLOWED = new Set([
  "src/lib/types.ts",
  // Asserts things ABOUT the declared field — that every template has one of
  // its own — which is the one question the resolver cannot answer, since it
  // returns the fallback either way.
  "src/lib/content/invariants.test.ts",
  "src/lib/completion-spec.test.ts",
  "src/lib/certificate.test.ts",
  "src/components/task/milestone-tracker.test.tsx",
  "src/components/task/task-experience.test.tsx",
]);

describe("the fallback is applied in exactly one place", () => {
  const files = sourceFiles(SRC).map((full) => ({
    rel: full.slice(root.length + 1).split("\\").join("/"),
    body: stripComments(readFileSync(full, "utf8")),
  }));

  it("the premise: the detector sees the shape that shipped", () => {
    // The exact expression that was in three files, so a pass here cannot be
    // a detector that matches nothing.
    const shipped = "const spec = completion ?? DEFAULT_COMPLETION;";
    expect(/\?\?\s*DEFAULT_COMPLETION/.test(shipped)).toBe(true);
  });

  it("no other file resolves it inline", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f.rel))
      .filter((f) => /\?\?\s*DEFAULT_COMPLETION/.test(f.body))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("and no other file reads template.completion instead of asking", () => {
    // Reading the raw field is the same defect wearing different clothes: it
    // silently returns undefined for the forty templates with no spec.
    const offenders = files
      .filter((f) => !ALLOWED.has(f.rel))
      .filter((f) => /(template|t)\.completion\b/.test(f.body))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("the exemption is not stale", () => {
    const known = new Set(files.map((f) => f.rel));
    for (const rel of ALLOWED) {
      expect(known.has(rel), rel + " is exempted but no longer exists").toBe(true);
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
