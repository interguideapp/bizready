-- ============================================================================
-- 013 — the tables the reminder system has always assumed existed.
--
-- `notifications` and `reminder_log` were referenced by src/lib/data.ts,
-- src/lib/actions.ts, the reminder cron and the integrations pipeline, but no
-- migration ever created them. Because every read in data.ts discarded its
-- error, the failure was invisible: the notifications page rendered
-- "הכל רגוע כרגע" whether the user was fine or the table was missing.
--
-- Migration 007 also declared a policy on public.notifications, so 007 itself
-- aborted — which means the six owner-write policies above that line never
-- landed either. They are re-created here.
--
-- Written to be idempotent so it is safe to apply to a database that has
-- already had 001-012 applied (and safe to re-run).
-- ============================================================================

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

-- NOTE: 007's "sync_metrics: owner update" policy is deliberately NOT restored.
-- It let a user rewrite their own revenue metrics — the figures that feed the
-- עוסק-פטור ceiling calculation. Metric corrections must go through a server
-- action, not a direct client update.
drop policy if exists "sync_metrics: owner update" on public.sync_metrics;
