module.exports = (s) => {
  s = s.replace(
    'import type { BusinessField, CompletionField, TaskTemplate } from "@/lib/types";',
    'import { completionSpecOf } from "@/lib/types";\nimport type { BusinessField, CompletionField, TaskTemplate } from "@/lib/types";'
  );
  s = s.replace(
    `    const spec = new Map(
      (template.completion?.fields ?? []).map((f) => [f.key, f])
    );`,
    `    // completionSpecOf, not template.completion: a template with no bespoke
    // spec still asks for the DEFAULT_COMPLETION note, and reading the raw
    // field would print that answer under the label "note".
    const spec = new Map(
      (completionSpecOf(template).fields ?? []).map((f) => [f.key, f])
    );`
  );
  return s;
};
