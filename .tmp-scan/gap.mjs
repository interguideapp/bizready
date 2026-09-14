import { TASK_TEMPLATES, CATEGORIES_BY_ID } from "../src/lib/content/index.ts";
const none = [], some = [];
for (const t of TASK_TEMPLATES) {
  const n = t.completion?.fields?.length ?? 0;
  (n === 0 ? none : some).push(t);
}
console.log("total", TASK_TEMPLATES.length, "| capture", some.length, "| capture nothing", none.length);
console.log("\n--- CAPTURE NOTHING ---");
for (const t of none) {
  console.log([t.category_id, t.id, t.priority, t.title].join(" | "));
}
