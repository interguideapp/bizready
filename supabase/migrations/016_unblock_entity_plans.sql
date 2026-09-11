-- ============================================================================
-- 016 — stop a dead mirror table from rejecting company and partnership plans.
--
-- THIS IS A LIVE BUG, not a cleanup. Found by checking production against the
-- shipped content rather than trusting the repo.
--
-- `public.task_templates` is a leftover from an earlier design where task
-- content lived in the database. The application abandoned that: the 70
-- templates live in src/lib/content, and grep for "task_templates" across src/
-- returns ZERO hits. Nothing reads this table.
--
-- But three foreign keys still point at it, and the table was populated
-- out-of-band and then drifted. Production holds 62 rows; the code ships 70. The
-- eight missing rows are exactly the incorporated-entity templates:
--
--   register-company, company-tax-files, company-bank-account,
--   company-annual-fee, company-annual-report-financials,
--   register-partnership, partnership-agreement, partnership-annual-fee
--
-- completeOnboarding writes the whole plan in ONE bulk upsert. A foreign-key
-- violation on any row aborts the entire statement, so onboarding as a
-- חברה בע"מ or a שותפות fails at the final step and the user's plan is never
-- created. business_tasks bears this out: 47 distinct template_ids in use, not
-- one of them an entity template. No company plan has ever been written.
--
-- The reminder sweep had the same exposure: production's notifications table
-- (also created out-of-band) carries a template_id FK to the same mirror, so a
-- notification about a company task would be rejected too.
--
-- Fix: drop the three foreign keys. The code is the source of truth for which
-- templates exist — buildPlan can only ever emit ids from TASK_TEMPLATES, and
-- content/invariants.test.ts already proves those ids are unique and that every
-- depends_on resolves. A hand-synced database mirror cannot add integrity here;
-- it can only drift, and it did.
--
-- The table itself is left in place and commented rather than dropped: dropping
-- it destroys 62 rows of (stale) content and is not needed to fix the bug. That
-- deletion is a separate, deliberate decision.
--
-- Non-destructive: three constraints dropped, one comment added. No data is
-- read, written or removed.
-- ============================================================================

begin;

alter table public.business_tasks
  drop constraint if exists business_tasks_template_id_fkey;

alter table public.offers
  drop constraint if exists offers_template_id_fkey;

-- Present in production (the out-of-band notifications table), absent from the
-- 013 definition. Dropping it makes the two converge.
alter table public.notifications
  drop constraint if exists notifications_template_id_fkey;

comment on table public.task_templates is
  'UNUSED. Task content lives in src/lib/content; nothing in the application '
  'reads this table. It drifted to 62 rows against the 70 the code ships, and '
  'its foreign keys blocked company and partnership onboarding until 016 '
  'removed them. Do not re-add a foreign key to it, and do not treat it as a '
  'source of truth.';

commit;
