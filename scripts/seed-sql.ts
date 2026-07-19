/** Prints seed SQL for categories + task_templates (for running via MCP). */
import { CATEGORIES, TASK_TEMPLATES } from "../src/lib/content";

const q = (s: string | null | undefined) =>
  s == null ? "null" : `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const catRows = CATEGORIES.map(
  (c) =>
    `(${q(c.id)}, ${q(c.title)}, ${q(c.description)}, ${q(c.icon)}, ${c.sort_order})`
).join(",\n");

console.log(`insert into public.categories (id, title, description, icon, sort_order) values\n${catRows}\non conflict (id) do update set title=excluded.title, description=excluded.description, icon=excluded.icon, sort_order=excluded.sort_order;\n`);

const tplRows = TASK_TEMPLATES.map(
  (t) =>
    `(${q(t.id)}, ${q(t.category_id)}, ${q(t.title)}, ${q(t.why)}, ${q(t.steps)}, ${j(t.official_links)}, ${j(t.docs_needed)}, ${q(t.est_cost)}, ${q(t.est_time)}, ${j(t.applies_when)}, ${j(t.depends_on)}, ${t.deadline_days ?? "null"}, ${q(t.recurrence ?? null)}, ${q(t.priority)}, ${q(t.source_url)}, 'reviewed', ${q(t.last_reviewed)}, ${t.sort_order})`
).join(",\n");

console.log(`insert into public.task_templates (id, category_id, title, why, steps, official_links, docs_needed, est_cost, est_time, applies_when, depends_on, deadline_days, recurrence, priority, source_url, review_status, last_reviewed, sort_order) values\n${tplRows}\non conflict (id) do update set category_id=excluded.category_id, title=excluded.title, why=excluded.why, steps=excluded.steps, official_links=excluded.official_links, docs_needed=excluded.docs_needed, est_cost=excluded.est_cost, est_time=excluded.est_time, applies_when=excluded.applies_when, depends_on=excluded.depends_on, deadline_days=excluded.deadline_days, recurrence=excluded.recurrence, priority=excluded.priority, source_url=excluded.source_url, last_reviewed=excluded.last_reviewed, sort_order=excluded.sort_order;`);
