-- ============================================================
-- Partner marketplace: public intake + admin management
-- ============================================================

-- Applications submitted from the public /partners page. Anyone (even
-- signed-out) can submit; only admins can read/triage them.
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  service_type text not null,          -- profession / category (see strategy tiers)
  tier text not null default 'free',   -- free | featured
  website text,
  message text,
  status text not null default 'new'   -- new | approved | rejected
);
alter table public.partner_applications enable row level security;

-- anyone may submit an application (public lead form)
create policy "applications: public insert" on public.partner_applications
  for insert
  with check (true);

-- Admin allowlist. To become an admin, run ONCE with your auth user id
-- (Supabase dashboard → Authentication → Users → copy the UUID):
--   insert into public.admin_users (user_id) values ('YOUR-AUTH-UUID');
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy "admin_users: read own" on public.admin_users
  for select
  using (auth.uid() = user_id);

-- admins can read + triage applications
create policy "applications: admin read" on public.partner_applications
  for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "applications: admin update" on public.partner_applications
  for update
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Featured (paid) placement flag on offers.
alter table public.offers add column if not exists is_featured boolean not null default false;

-- Admins can fully manage offers (the public read-active policy still applies).
create policy "offers: admin manage" on public.offers
  for all
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
