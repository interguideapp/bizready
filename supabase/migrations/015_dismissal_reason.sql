-- ============================================================================
-- 015 — split "this doesn't apply to me" into its two real meanings.
--
-- `not_relevant` collapsed two completely different statements into one status,
-- and three engines (compliance, journey, nextSteps) read that single status as
-- fully satisfying a dependency. So an עוסק מורשה who dismissed "open a VAT
-- file" as not relevant thereby UNLOCKED a real, penalty-framed periodic VAT
-- obligation — for a business with no VAT file. A user's opinion that a setup
-- step does not apply to them must not be what starts a statutory duty running.
--
--   not_applicable      "this rule isn't about me."  Does NOT satisfy a
--                       statutory prerequisite, and leaves the readiness score
--                       on both sides.
--   handled_externally  "this is done, just not through BizReady" — the
--                       accountant filed it, the lawyer holds the agreement.
--                       Satisfies prerequisites and counts as done.
--
-- Rows written before this migration keep dismissal = null. src/lib/task-status.ts
-- reads those as not_applicable, which is the reading that claims least: a
-- legacy dismissal can never silently keep a fabricated deadline running.
--
-- Purely additive: one nullable column, one nullable note, one check constraint.
-- No data is read, moved or destroyed, and the existing `status` enum is
-- untouched so every current row stays valid.
-- ============================================================================

begin;

alter table public.business_tasks
  add column if not exists dismissal text,
  -- Why the user set it aside, in their words. Evidence for the audit trail:
  -- "my accountant files this" is a materially different record from a bare
  -- dismissal, and an inspector asking "why is this open?" deserves the answer.
  add column if not exists dismissal_note text;

-- Only the two known values, and only alongside the status they belong to.
-- Named so a failed write says which rule it broke.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_tasks_dismissal_valid'
  ) then
    alter table public.business_tasks
      add constraint business_tasks_dismissal_valid
      check (dismissal is null or dismissal in ('not_applicable', 'handled_externally'));
  end if;
end $$;

-- A dismissal reason on a task that is not dismissed would be read by nothing
-- and would quietly contradict the status. Enforce the pairing.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_tasks_dismissal_needs_status'
  ) then
    alter table public.business_tasks
      add constraint business_tasks_dismissal_needs_status
      check (dismissal is null or status = 'not_relevant');
  end if;
end $$;

-- Finding the dismissals that never said which kind they were — the set the
-- product has to go back and ask about.
create index if not exists business_tasks_unclarified_dismissal_idx
  on public.business_tasks (business_id)
  where status = 'not_relevant' and dismissal is null;

commit;
