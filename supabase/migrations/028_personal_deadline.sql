-- ============================================================================
-- 028 — a deadline the user chose, which the system is not allowed to overwrite.
--
-- `due_date` looks like the obvious place for "the date I want to do this by".
-- It is not, and putting a user's choice there would lose it silently:
--
--   * For a statutory filing the column is owned by the reminder sweep.
--     reminders.ts rolls it forward to the next period's legal date whenever the
--     period turns over (`task.due_date !== periodDue`), which is what fixed a
--     monthly filer silently skipping every other deadline. Any personal date
--     sitting there would be erased by the next cron run, with no error and no
--     way for the user to tell it had happened.
--
--   * For a non-statutory recurring task the same file rolls a stale date
--     forward so the reminder dedupe key stops being byte-identical every day.
--
-- So `due_date` is the system's date and this is the person's. Separating them
-- also makes the display honest: the product can show the legal deadline AND
-- the target you set for yourself, which is the distinction the whole
-- honest-deadlines design rests on. Previously a statutory task simply had no
-- editable date at all — DueDateControl hid the editor whenever basis was
-- "statutory" — so there was no way to say "remind me a week early" on exactly
-- the obligations where people most want to.
--
-- Precedence, implemented in one place and tested: the user's date wins for
-- display and for reminders; the system's date is the fallback. Nothing derives
-- statutory STATUS from either — that comes from the compliance engine, which
-- is the single authority on what the law requires and when.
--
-- A plain nullable date. Null means "the user has not chosen one", which is the
-- state every existing row is in and is rendered as such rather than guessed.
-- ============================================================================

begin;

alter table public.business_tasks
  add column if not exists personal_due_date date;

comment on column public.business_tasks.personal_due_date is
  'The deadline the USER set. Never written by the reminder sweep, which owns '
  'due_date and rolls it forward per statutory period — a personal date stored '
  'there would be silently overwritten. Wins over due_date for display and '
  'reminders; neither decides statutory status, which comes from the '
  'compliance engine.';

commit;
