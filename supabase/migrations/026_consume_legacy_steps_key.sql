-- ============================================================================
-- 026 — make 025 honestly idempotent by consuming the key it copied.
--
-- 025's header claimed that re-running it "can never overwrite progress the
-- user has changed since". That was wrong, and writing the CI test for it is
-- what exposed the lie: 025's guard is "the column is empty", which cannot
-- distinguish
--
--   (a) this row was never migrated            -> backfilling is correct
--   (b) the user unticked every step           -> backfilling RESURRECTS ticks
--
-- Both look like '{}'. So a second application of 025 — a migration replay, a
-- restore-then-reapply, anyone running the set twice — would silently put back
-- progress the user had deliberately cleared, on the screen whose whole job is
-- telling them what is still outstanding.
--
-- The fix is to remove the ambiguity rather than document it: delete the
-- `__steps_done` key once its value is safely in the typed column. Then case
-- (a) is "the key is present" and case (b) is "the key is gone", and a re-run
-- of either migration is a genuine no-op.
--
-- This is not data loss. The value was copied to business_tasks.steps_done by
-- 025, which ran first and is verified; the key held bookkeeping, never
-- evidence (task-experience.tsx has always hidden `__`-prefixed keys from the
-- evidence display). What remains in completion_data is the completion evidence
-- that column is actually for.
-- ============================================================================

begin;

-- Only where the value is provably already in the column, so this cannot run
-- ahead of 025 and drop something that was never copied. A row whose key lists
-- an index the column does not have is left alone and shows up in the CI
-- assertion rather than being quietly discarded.
--
-- The CASE is load-bearing, not defensive noise. jsonb_array_elements_text()
-- raises 22023 "cannot extract elements from a scalar" on a non-array, and the
-- first version of this statement put that call in the left arm of an OR whose
-- right arm was the type check. SQL does not guarantee OR short-circuiting, and
-- in practice the extraction ran first — so a single row with, say,
-- '{"__steps_done": 7}' aborted the migration and took the whole set with it.
-- Coercing a non-array to '[]' means the function is never handed a scalar, and
-- the row is then treated as contributing nothing (which is true) and has its
-- key consumed.
update public.business_tasks t
set completion_data = t.completion_data - '__steps_done'
where t.completion_data ? '__steps_done'
  and not exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(t.completion_data -> '__steps_done') = 'array'
          then t.completion_data -> '__steps_done'
        else '[]'::jsonb
      end
    ) as raw(txt)
    where raw.txt ~ '^[0-9]+$'
      and not (raw.txt::int = any (coalesce(t.steps_done, '{}'::int[])))
  );

commit;
