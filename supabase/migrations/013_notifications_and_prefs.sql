-- ============================================================================
-- 013 — reconcile the migration set with the schema production actually has.
--
-- No migration in this repo creates notifications or reminder_log, nor the
-- businesses.notify_email / notify_whatsapp / whatsapp_phone columns — yet
-- data.ts, actions.ts, the reminder cron and the integrations pipeline all read
-- and write them. Production HAS them (created out-of-band), so the live app
-- works; the repo simply cannot reproduce it. A fresh environment, a new
-- teammate, or a disaster-recovery restore would come up with a silently
-- broken reminder system — and because every read in data.ts used to discard
-- its error, that breakage would have been invisible.
--
-- 007 also declared a policy on public.notifications. That aborts on a clean
-- apply (taking its six owner-write policies with it), so the policy moved here
-- next to the CREATE TABLE it depends on, and those six are re-created below.
--
-- Everything here is idempotent: safe on production (where most of it already
-- exists), safe on a clean database, and safe to re-run.
-- ============================================================================

-- All-or-nothing. The nine "drop policy ... / create policy ..." pairs below
-- re-assert policy definitions so the repo matches the database. Wrapped in a
-- transaction so a mid-script failure can never leave a policy dropped: on
-- abort, every policy is restored exactly as it was.
--
-- Nothing here destroys data: no drop table, no drop column, no delete, no
-- truncate. Table and column creation is all "if not exists".
begin;

-- ---------- notification prefs on the business ----------
alter table public.businesses add column if not exists notify_email boolean not null default true;
alter table public.businesses add column if not exists notify_whatsapp boolean not null default false;
alter table public.businesses add column if not exists whatsapp_phone text;

-- ---------- in-app notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- deadline | overdue | recurring | integration
  type text not null,
  title text not null,
  body text,
  template_id text,
  -- one notification per (business, dedupe_key): lets the daily sweep be
  -- idempotent and re-runnable without spamming.
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, dedupe_key)
);

alter table public.notifications enable row level security;

drop policy if exists "notifications: owner read" on public.notifications;
create policy "notifications: owner read" on public.notifications
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

-- owners may only mark their own notifications read; the sweep inserts with the
-- service role, and owners may insert their own (integration pipeline).
drop policy if exists "notifications: owner insert" on public.notifications;
create policy "notifications: owner insert" on public.notifications
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "notifications: owner update" on public.notifications;
create policy "notifications: owner update" on public.notifications
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create index if not exists notifications_unread_idx
  on public.notifications (business_id, created_at desc)
  where read_at is null;

-- ---------- outbound send log (email / whatsapp / push dedupe) ----------
-- Service-role only: the cron writes it, no user session reads it. No policies
-- are granted, so RLS denies every anon/authenticated access by default.
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  channel text not null, -- email | whatsapp | push
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  unique (business_id, channel, dedupe_key)
);

alter table public.reminder_log enable row level security;

-- ---------- re-create the policies that 007 never applied ----------
-- (007 aborted on the notifications policy above, taking these with it.)
drop policy if exists "synced_documents: owner write" on public.synced_documents;
create policy "synced_documents: owner write" on public.synced_documents
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "synced_contacts: owner write" on public.synced_contacts;
create policy "synced_contacts: owner write" on public.synced_contacts
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "synced_orders: owner write" on public.synced_orders;
create policy "synced_orders: owner write" on public.synced_orders
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "sync_metrics: owner write" on public.sync_metrics;
create policy "sync_metrics: owner write" on public.sync_metrics
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "sync_errors: owner insert" on public.sync_errors;
create policy "sync_errors: owner insert" on public.sync_errors
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

-- sync_metrics owner UPDATE is REQUIRED, not a hole: both the manual income
-- logger (setMonthlyIncome) and owner-session sync upsert into this table, and
-- an upsert needs UPDATE as well as INSERT. The user reporting their own
-- revenue is the feature, not an attack — there is no other party to deceive.
drop policy if exists "sync_metrics: owner update" on public.sync_metrics;
create policy "sync_metrics: owner update" on public.sync_metrics
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

commit;
