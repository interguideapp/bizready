-- ============================================================================
-- 014 — make the audit trail something a business could actually rely on.
--
-- Three problems this fixes:
--
-- 1. Step progress lived in completion_data under a magic "__steps_done" key,
--    in the same jsonb column as completion evidence. completeTask replaced
--    that column wholesale, so closing a task silently destroyed the step
--    history (and any evidence the invoicing webhook had written). The merge is
--    already fixed in code; this gives progress its own typed column so the two
--    can never collide again.
--
-- 2. task_events had no idea WHO did anything — no actor, no source. Every row
--    was implicitly "the owner".
--
-- 3. task_events was append-only by policy (no UPDATE/DELETE), but task_id was
--    ON DELETE CASCADE from business_tasks, and owners held `for all` on
--    business_tasks — which includes DELETE. So a user could delete a task and
--    cascade-wipe its entire history. An append-only log you can erase through
--    the back door is not evidence.
--
-- Idempotent and transactional.
-- ============================================================================

begin;

-- ---------- 1. step progress gets its own column ----------
alter table public.business_tasks
  add column if not exists steps_done int[] not null default '{}';

-- NOTE: the jsonb "__steps_done" key is deliberately NOT migrated or removed
-- here. The application still reads it, and because data.ts now fails loudly on
-- a read error, moving the data before the code cutover would break every task
-- page. This migration only PREPARES the column; the read/write cutover ships
-- as a code+migration pair once 014 is applied. That keeps 014 safe to apply
-- at any time, in any order.

-- ---------- 2. attribution + tamper-evident chain on the trail ----------
alter table public.task_events add column if not exists actor_id uuid;
-- owner | system | integration
alter table public.task_events add column if not exists actor_kind text not null default 'owner';
alter table public.task_events add column if not exists prev_hash text;
alter table public.task_events add column if not exists hash text;

-- Each row hashes its own content plus the previous row's hash, per business.
-- Rewriting or removing a row therefore breaks the chain from that point on,
-- which is what makes the log verifiable rather than merely append-only.
-- sha256() is built into Postgres 11+, so no extension is required.
create or replace function public.task_events_chain()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  prev text;
  payload text;
begin
  if new.actor_id is null then
    new.actor_id := auth.uid ();
  end if;

  select e.hash into prev
    from public.task_events e
   where e.business_id = new.business_id
   order by e.created_at desc, e.id desc
   limit 1;

  new.prev_hash := prev;

  payload :=
    coalesce(prev, '') || '|' ||
    new.business_id::text || '|' ||
    coalesce(new.task_id::text, '') || '|' ||
    coalesce(new.template_id, '') || '|' ||
    coalesce(new.kind, '') || '|' ||
    coalesce(new.from_status, '') || '|' ||
    coalesce(new.to_status, '') || '|' ||
    coalesce(new.detail, '') || '|' ||
    coalesce(new.actor_kind, '') || '|' ||
    coalesce(new.actor_id::text, '') || '|' ||
    new.created_at::text;

  new.hash := encode(sha256(convert_to(payload, 'utf8')), 'hex');
  return new;
end
$$;

drop trigger if exists task_events_chain_tr on public.task_events;
create trigger task_events_chain_tr
  before insert on public.task_events
  for each row execute function public.task_events_chain();

-- ---------- 3. the trail must survive its task ----------
-- Owners keep read/insert/update on their tasks but lose DELETE, so the
-- ON DELETE CASCADE to task_events can no longer be triggered from a session.
-- (Nothing in the application deletes a business_task; account deletion goes
-- through the business row, where cascading the trail is the correct behaviour.)
drop policy if exists "business_tasks: owner all" on public.business_tasks;

drop policy if exists "business_tasks: owner read" on public.business_tasks;
create policy "business_tasks: owner read" on public.business_tasks
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "business_tasks: owner insert" on public.business_tasks;
create policy "business_tasks: owner insert" on public.business_tasks
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "business_tasks: owner update" on public.business_tasks;
create policy "business_tasks: owner update" on public.business_tasks
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  ) with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

commit;
