-- ============================================================================
-- 027 — where a task actually is, not just whether it is open.
--
-- business_tasks.status held four values (todo / in_progress / waiting / done)
-- and the user maintained them by hand. Two consequences, both of which this
-- column exists to end:
--
-- 1. "waiting" could not say WHAT for. The reason was free text the user typed
--    into a dialog (`waiting_for`), and the follow-up date was one they picked
--    themselves — so the product asked for three things it already knew. A
--    business licence waits first for inspections and then for the licence
--    itself; one boolean-ish status cannot tell those apart.
--
-- 2. Nothing recorded position. "בתהליך" is true of a task on its first step
--    and of one a single signature from finished.
--
-- `stage` stores a stage id from src/lib/content/milestones.ts. The chain there
-- is the authority on ordering and on which stages are a hand-off, and the
-- STATUS IS DERIVED FROM IT in one direction only — the server sets both in the
-- same write. That direction matters: deriving both ways is how the home screen
-- and the compliance engine came to disagree about overdue debts.
--
-- Deliberately a plain text column with no check constraint and no foreign key.
-- The stage vocabulary lives in content, which ships with the application and
-- changes without a migration; a constraint here would mean a database
-- migration every time a chain gains a step, and a stale constraint would
-- reject writes the application considers valid. Unknown or renamed ids are
-- handled in code, which falls back to placing the task by its status — see
-- stageIndexOf, which is tested for exactly that case.
--
-- Nullable, and every existing row stays null: a null stage means "nobody has
-- advanced this task since the feature shipped", which is true and is rendered
-- honestly rather than guessed at write time.
-- ============================================================================

begin;

alter table public.business_tasks
  add column if not exists stage text;

comment on column public.business_tasks.stage is
  'Current milestone id, from src/lib/content/milestones.ts. The chain there '
  'decides ordering and which stages are an external hand-off, and status is '
  'derived from this in one direction. Null means never advanced; code places '
  'such a row by its status instead. No check constraint on purpose — the '
  'vocabulary lives in content and changes without a migration.';

-- The home screen asks for "everything currently waiting on someone else",
-- which is a status filter, and then reads the stage of each row. Indexing the
-- stage alone would not help that; this supports the query that is actually run.
create index if not exists business_tasks_stage_idx
  on public.business_tasks (business_id, status)
  where stage is not null;

commit;
