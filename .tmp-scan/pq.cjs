module.exports = (s) => s.replace(
  "      (completionSpecOf(template).fields ?? []).map((f) => [f.key, f])",
  "      (template.completion?.fields ?? []).map((f) => [f.key, f])"
);
