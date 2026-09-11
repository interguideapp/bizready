-- ============================================================================
-- 024 — an owner may RESOLVE a sync error, not rewrite it.
--
-- 006 granted `sync_errors: owner update` with no column restriction, so a
-- session could change `code`, `message` and `hint` — not merely mark the error
-- resolved. That matters because these rows are the record of what the
-- invoicing integration could not reconcile: a missing allocation number, a
-- truncated pull, an invoice that failed validation. Being able to edit that
-- text is being able to alter the account of what went wrong, which is the same
-- class of problem as an editable audit trail.
--
-- RLS is row-level and cannot say "this column yes, those no", so the guard is
-- a trigger — the same approach as 019's subscription guard, and the check is
-- on current_user for the same reason: PostgREST sets it from the signed JWT,
-- so a client cannot influence it.
--
-- Purely additive: one function, one trigger. The existing policies are
-- untouched, so resolving an error keeps working exactly as it does today.
-- ============================================================================

begin;

/**
 * Rejects a session-level edit to anything but the resolution fields.
 *
 * `resolved_at` is the whole point of the owner's UPDATE grant: "I have dealt
 * with this". Everything else is the system's account of what happened.
 */
create or replace function public.guard_sync_error_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- The sync pipeline writes these rows and may correct them.
  if current_user::text in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.code is distinct from old.code
     or new.message is distinct from old.message
     or new.hint is distinct from old.hint
     or new.business_id is distinct from old.business_id
     or new.connection_id is distinct from old.connection_id
     or new.occurred_at is distinct from old.occurred_at then
    raise exception
      'a sync error can be resolved but not rewritten — code, message, hint and '
      'provenance are the system''s record of what failed'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists sync_errors_guard on public.sync_errors;
create trigger sync_errors_guard
  before update on public.sync_errors
  for each row execute function public.guard_sync_error_columns();

comment on trigger sync_errors_guard on public.sync_errors is
  'Owners may set resolved_at and nothing else. 006 granted an unrestricted '
  'owner UPDATE, which allowed rewriting the message describing what the '
  'integration failed to reconcile — an editable record of a failure.';

commit;
