-- ============================================================================
-- 025 — finish what 014 deliberately left half-done.
--
-- 014 added business_tasks.steps_done (int[]) but moved no data and changed no
-- code, on purpose: its own header says "this migration only PREPARES the
-- column; the read/write cutover ships as a code+migration pair once 014 is
-- applied." 014 is now applied to production, so this is that pair's migration
-- half.
--
-- Why the column matters at all: step progress lived under a magic
-- `__steps_done` key inside completion_data, the same jsonb column that holds
-- completion evidence — including evidence written by the invoicing webhook.
-- completeTask replaced that column wholesale, so closing a task destroyed
-- both. The merge is fixed in code, but two unrelated things sharing one
-- untyped column will collide again eventually. A typed column cannot.
--
-- The column becomes authoritative; the `__steps_done` key becomes inert.
--
-- ON IDEMPOTENCY — this migration alone is NOT safely re-runnable, and an
-- earlier version of this comment wrongly claimed it was. The guard below is
-- "the column is empty", which cannot tell "never migrated" from "the user
-- unticked every step" — both are '{}' — so a second application would
-- resurrect cleared progress. **026 removes the key once its value is in the
-- column**, which makes the guard unambiguous and both migrations genuine
-- no-ops on a re-run. 025 and 026 are a pair; do not apply one without the
-- other.
-- ============================================================================

begin;

/**
 * Copy the jsonb key into the typed column, defensively.
 *
 * The jsonb came from client input by way of a Server Action, so it is not
 * guaranteed to hold what it should. Anything that is not a non-negative
 * integer is dropped rather than trusted — an int[] column with a negative or
 * fractional index in it would be a crash waiting for whichever render indexes
 * into the step list with it.
 */
update public.business_tasks t
set steps_done = coalesce(
  (
    select array_agg(distinct e.v order by e.v)
    from jsonb_array_elements_text(t.completion_data -> '__steps_done') as raw(txt)
    cross join lateral (
      select case
        when raw.txt ~ '^[0-9]+$' then raw.txt::int
        else null
      end as v
    ) as e
    where e.v is not null
  ),
  '{}'::int[]
)
where t.completion_data ? '__steps_done'
  and jsonb_typeof(t.completion_data -> '__steps_done') = 'array'
  -- Only rows the cutover has not already handled. This is what makes a
  -- re-run safe: a user who has since unticked every step has steps_done =
  -- '{}' and completion_data still listing them, and re-running must NOT
  -- resurrect those ticks.
  and (t.steps_done is null or t.steps_done = '{}'::int[]);

comment on column public.business_tasks.steps_done is
  'Completed step indices, authoritative since 025. Previously lived under a '
  '__steps_done key in completion_data, alongside completion evidence, where a '
  'whole-column write destroyed both. The old key is retained as history and '
  'is no longer read.';

commit;
