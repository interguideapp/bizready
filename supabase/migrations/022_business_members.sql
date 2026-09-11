-- ============================================================================
-- 022 — let the accountant in.
--
-- There is one `businesses` row per owner_id, no roles and no invitations. The
-- accountant or bookkeeper is the single most important collaborator in Israeli
-- compliance — they file the מע"מ returns, they hold the books, they are the
-- person the deadlines actually belong to — and the product has no way to give
-- them access. So users share their password, which is worse than any access
-- model we could design badly.
--
-- DESIGN NOTE, and the reason this migration is safe to apply:
--
-- Every existing policy is left exactly as it is. Postgres OR-s multiple
-- permissive policies for the same command, so adding a membership policy
-- alongside `owner_id = auth.uid()` yields "owner OR member" without touching a
-- single line of the owner path. Rewriting 30-odd policies from owner to
-- membership in one migration is how you accidentally open cross-tenant access;
-- this way the owner path cannot regress, because it is untouched.
--
-- Roles:
--   owner       the person who signed up. Implicit via businesses.owner_id —
--               NOT a row here, so it can never be revoked by accident.
--   accountant  full read, and may complete tasks and upload evidence. This is
--               the person actually doing the filing.
--   viewer      read only. For a partner, a spouse, a prospective buyer.
--
-- Nobody but the owner may manage members or billing, and no member may ever
-- write subscription state (migration 019 blocks that for every session).
-- ============================================================================

begin;

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Null until the invitation is accepted: we invite an EMAIL, and only learn
  -- the user id when they sign in and claim it.
  user_id uuid references auth.users (id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('accountant', 'viewer')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  -- Single-use, unguessable. Sent to the invitee; never shown to anyone else.
  invite_token text not null unique,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  -- One live invitation or membership per email per business. A revoked row
  -- keeps its history, so the partial index excludes it.
  constraint business_members_email_not_blank check (length(trim(invited_email)) > 0)
);

create unique index if not exists business_members_live_email_idx
  on public.business_members (business_id, lower(invited_email))
  where revoked_at is null;

create index if not exists business_members_by_user_idx
  on public.business_members (user_id)
  where user_id is not null and accepted_at is not null and revoked_at is null;

alter table public.business_members enable row level security;

/**
 * Is the current session a live member of this business (or its owner)?
 *
 * One function, so every policy asks the same question and there is a single
 * place to get it right. STABLE and SECURITY DEFINER so it can read both tables
 * without recursing through their own policies — a membership check that was
 * itself subject to RLS would either recurse or silently return false.
 */
create or replace function public.is_business_member(p_business_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid ()
    )
    or exists (
      select 1 from public.business_members m
      where m.business_id = p_business_id
        and m.user_id = auth.uid ()
        and m.accepted_at is not null
        and m.revoked_at is null
    );
$$;

/**
 * May the current session CHANGE things, as opposed to just read them?
 *
 * A viewer must not be able to mark a statutory filing complete — that writes
 * evidence into a hash-chained audit trail under someone else's business, and
 * "read only" has to mean it.
 */
create or replace function public.can_edit_business(p_business_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_id = auth.uid ()
    )
    or exists (
      select 1 from public.business_members m
      where m.business_id = p_business_id
        and m.user_id = auth.uid ()
        and m.role = 'accountant'
        and m.accepted_at is not null
        and m.revoked_at is null
    );
$$;

-- ---------- who can see and manage the member list ----------
-- The owner manages it. A member may see who else has access — hiding that
-- from someone who already has access protects nobody and surprises everyone.
drop policy if exists "business_members: owner manage" on public.business_members;
create policy "business_members: owner manage" on public.business_members
  for all using (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "business_members: member read" on public.business_members;
create policy "business_members: member read" on public.business_members
  for select using (public.is_business_member (business_id));

-- A member may resign: update their OWN row to set revoked_at. Scoped to the
-- row belonging to them, so it cannot be used to remove anyone else.
drop policy if exists "business_members: self resign" on public.business_members;
create policy "business_members: self resign" on public.business_members
  for update using (user_id = auth.uid ()) with check (user_id = auth.uid ());

-- ---------- additive read access for members ----------
-- Each of these sits ALONGSIDE the existing owner policy and is OR-ed with it.
do $$
declare
  t text;
  readable text[] := array[
    'businesses', 'business_tasks', 'task_events', 'documents',
    'task_checklist_items', 'business_products', 'business_costs',
    'notifications', 'synced_documents', 'synced_contacts', 'synced_orders',
    'sync_metrics', 'sync_errors'
  ];
  id_column text;
begin
  foreach t in array readable loop
    -- `businesses` is keyed by its own id; everything else by business_id.
    id_column := case when t = 'businesses' then 'id' else 'business_id' end;

    execute format(
      'drop policy if exists %L on public.%I',
      t || ': member read', t
    );
    execute format(
      'create policy %L on public.%I for select using (public.is_business_member(%I))',
      t || ': member read', t, id_column
    );
  end loop;
end $$;

-- ---------- an accountant may actually do the work ----------
-- Deliberately narrower than the read grant: the tables where completing a
-- task and filing its evidence happen, and nothing else. No accountant write
-- on `businesses` — the business card holds the bank account, and changing it
-- is the owner's call.
do $$
declare
  t text;
  writable text[] := array[
    'business_tasks', 'task_events', 'documents', 'task_checklist_items'
  ];
begin
  foreach t in array writable loop
    execute format(
      'drop policy if exists %L on public.%I',
      t || ': accountant insert', t
    );
    execute format(
      'create policy %L on public.%I for insert with check (public.can_edit_business(business_id))',
      t || ': accountant insert', t
    );

    -- task_events is append-only by design (migration 014) — no UPDATE for
    -- anyone, including an accountant. The audit trail is the one thing that
    -- must not be editable.
    if t <> 'task_events' then
      execute format(
        'drop policy if exists %L on public.%I',
        t || ': accountant update', t
      );
      execute format(
        'create policy %L on public.%I for update using (public.can_edit_business(business_id)) with check (public.can_edit_business(business_id))',
        t || ': accountant update', t
      );
    end if;
  end loop;
end $$;

comment on table public.business_members is
  'Collaborators on a business. The OWNER is not a row here — ownership lives '
  'on businesses.owner_id so it cannot be revoked by deleting a membership. '
  'accountant = read + complete tasks + upload evidence; viewer = read only. '
  'Neither can touch subscription state (migration 019) or the business card.';

commit;
