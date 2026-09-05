-- ============================================================
-- Partner leads: in-app "have them call me" capture on an offer.
-- Gives the owner billable proof of a lead even if the deal closes off-app.
-- ============================================================

create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  offer_id uuid references public.offers (id) on delete set null,
  partner_hint text,                 -- snapshot of the offer title (admin readability)
  contact_name text,
  contact_email text,
  contact_phone text,
  note text,
  status text not null default 'new' -- new | sent | won | lost
);
alter table public.partner_leads enable row level security;

-- the business owner may create a lead for their own business
create policy "partner_leads: owner insert" on public.partner_leads
  for insert
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

-- admins read + triage every lead (the billing basis)
create policy "partner_leads: admin read" on public.partner_leads
  for select
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid ()));
create policy "partner_leads: admin update" on public.partner_leads
  for update
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid ()));

create index if not exists partner_leads_offer_idx on public.partner_leads (offer_id, created_at desc);
