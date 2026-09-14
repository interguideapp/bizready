module.exports = (s) => {
  s = s.replace(
    'import { DEFAULT_COMPLETION } from "@/lib/types";',
    'import { completionSpecOf } from "@/lib/types";'
  );
  s = s.replace(
    "  const spec = completion ?? DEFAULT_COMPLETION;",
    "  const spec = completionSpecOf({ completion });"
  );
  s = s.replace(
    "    for (const field of (completion ?? DEFAULT_COMPLETION).fields ?? []) {",
    "    for (const field of completionSpecOf({ completion }).fields ?? []) {"
  );
  return s;
};
