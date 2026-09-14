-- The evidence pack claimed a verification that did not exist.
--
-- verifyChain in lib/evidence.ts checks the chain's LINKAGE: every row carries
-- its predecessor's hash, so removal, reordering and insertion are detected.
-- Its docstring then says content-level tampering "is what the stored hash
-- itself protects against; recomputing that is done in the database, where the
-- canonical expression lives", and the pack's own method line tells the reader
-- "Content edits are covered by the stored hash itself."
--
-- Nothing recomputed it. There was no function, nothing called one, and the
-- claim pointed at a mechanism that was never built -- on the one document
-- whose entire purpose is provability. An honest-sounding disclosure that
-- defers to something absent is worse than no disclosure, because the reader
-- stops looking.
--
-- Worth stating precisely what the exposure was and was not. task_events has
-- only INSERT and SELECT policies -- no UPDATE, no DELETE -- so no session can
-- alter a row at all, and the linkage check already covered insertion and
-- removal. What was unprotected is tampering through the service role or
-- direct database access, which is exactly the threat a content hash exists
-- for and the one the pack was claiming to have checked.
--
-- ONE PAYLOAD EXPRESSION, used by the writer and the verifier. Two copies of
-- it would be the failure this codebase has hit repeatedly: the verifier would
-- drift from the trigger and report tampering on untouched rows, which on this
-- feature is the worst possible outcome -- a false accusation in a document
-- meant to prove good standing.
begin;

create or replace function public.task_events_payload (e public.task_events)
  returns text
  language sql
  immutable
  set search_path = public
as $fn$
  select
    coalesce(e.prev_hash, '') || '|' ||
    e.seq::text || '|' ||
    e.business_id::text || '|' ||
    coalesce(e.task_id::text, '') || '|' ||
    coalesce(e.template_id, '') || '|' ||
    coalesce(e.kind, '') || '|' ||
    coalesce(e.from_status, '') || '|' ||
    coalesce(e.to_status, '') || '|' ||
    coalesce(e.detail, '') || '|' ||
    coalesce(e.actor_kind, '') || '|' ||
    coalesce(e.actor_id::text, '') || '|' ||
    e.created_at::text;
$fn$;

comment on function public.task_events_payload (public.task_events) is
  'The exact bytes a task_events row hashes. Used by the chain trigger that '
  'writes the hash AND by task_events_content_ok that re-checks it, so the '
  'two can never disagree about what was signed.';

-- The trigger now builds its payload from that one expression.
create or replace function public.task_events_chain ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  prev text;
begin
  if new.actor_id is null then
    new.actor_id := auth.uid ();
  end if;

  -- Ordered by seq, not created_at: now() is the transaction timestamp, so
  -- rows written together share it and the tie-break would be a random uuid.
  select e.hash into prev
    from public.task_events e
   where e.business_id = new.business_id
   order by e.seq desc
   limit 1;

  new.prev_hash := prev;
  new.hash := encode(sha256(convert_to(public.task_events_payload(new), 'utf8')), 'hex');
  return new;
end
$$;

drop trigger if exists task_events_chain_tr on public.task_events;
create trigger task_events_chain_tr
  before insert on public.task_events
  for each row execute function public.task_events_chain();

-- Recompute every signed row's hash from its own content and report.
--
-- security definer so it can read the rows regardless of policy, with the
-- caller's right to see this business checked explicitly first -- the same
-- shape sweep_health and push_reach use. It returns counts and the first
-- offending seq, never row contents, so the report itself leaks nothing.
create or replace function public.task_events_content_ok (target uuid)
  returns table (checked bigint, mismatched bigint, first_bad_seq bigint, unsigned bigint)
  language plpgsql
  stable
  security definer
  set search_path = public
as $fn$
begin
  if not (
    exists (select 1 from public.businesses b where b.id = target and b.owner_id = auth.uid())
    or public.is_business_member(target)
  ) then
    -- Not yours: no counts, no hint about whether the business exists.
    return;
  end if;

  return query
  with signed as (
    select e.seq,
           e.hash,
           encode(sha256(convert_to(public.task_events_payload(e), 'utf8')), 'hex') as recomputed
      from public.task_events e
     where e.business_id = target
       and e.hash is not null
  )
  select
    (select count(*) from signed),
    (select count(*) from signed s where s.hash <> s.recomputed),
    (select min(s.seq) from signed s where s.hash <> s.recomputed),
    (select count(*) from public.task_events e
      where e.business_id = target and e.hash is null);
end
$fn$;

comment on function public.task_events_content_ok (uuid) is
  'Re-derives every signed trail row hash from its stored content and counts '
  'the mismatches. Detects an in-place edit, which the linkage check cannot. '
  'Returns no rows to a caller who may not read the business.';

commit;
