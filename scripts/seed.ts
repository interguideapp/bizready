/**
 * Seeds categories + task templates into Supabase.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, TASK_TEMPLATES } from "../src/lib/content";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { error: catError } = await supabase.from("categories").upsert(
    CATEGORIES.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      sort_order: c.sort_order,
    }))
  );
  if (catError) throw new Error(`categories: ${catError.message}`);
  console.log(`✓ ${CATEGORIES.length} categories`);

  const { error: tplError } = await supabase.from("task_templates").upsert(
    TASK_TEMPLATES.map((t) => ({
      id: t.id,
      category_id: t.category_id,
      title: t.title,
      why: t.why,
      steps: t.steps,
      official_links: t.official_links,
      docs_needed: t.docs_needed,
      est_cost: t.est_cost ?? null,
      est_time: t.est_time ?? null,
      applies_when: t.applies_when,
      depends_on: t.depends_on,
      deadline_days: t.deadline_days ?? null,
      recurrence: t.recurrence ?? null,
      priority: t.priority,
      source_url: t.source_url ?? null,
      review_status: "reviewed",
      last_reviewed: t.last_reviewed,
      sort_order: t.sort_order,
    }))
  );
  if (tplError) throw new Error(`task_templates: ${tplError.message}`);
  console.log(`✓ ${TASK_TEMPLATES.length} task templates`);
}

main().then(
  () => console.log("Seed complete"),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
