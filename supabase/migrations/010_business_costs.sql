-- Cost ledger: what the business pays for each tool / service.

create table public.business_costs (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  amount numeric(10, 2) not null default 0,
  cadence text not null default 'monthly', -- monthly | yearly | one_time
  template_id text,                          -- optional link to a task template
  renewal_date date,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.business_costs enable row level security;

create policy "business_costs: owner all" on public.business_costs
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create index business_costs_business_idx on public.business_costs (business_id, created_at desc);
