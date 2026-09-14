module.exports = (s) => {
  s = s.replace(
    'import { DEFAULT_COMPLETION, YEARLY_FIGURES } from "@/lib/types";',
    'import { YEARLY_FIGURES, completionSpecOf } from "@/lib/types";'
  );
  s = s.replace(
    "    completion: template.completion ?? DEFAULT_COMPLETION,",
    "    completion: completionSpecOf(template),"
  );
  return s;
};
