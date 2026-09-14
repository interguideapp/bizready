module.exports = (s) =>
  s.replace(
    'import { ANSWER_ORDER } from "@/lib/types";',
    'import { ANSWER_ORDER, completionSpecOf } from "@/lib/types";'
  );
