-- Smart business profile: logo + price list

alter table public.businesses
  add column logo_path text;

create table public.business_products (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2),
  unit text not null default 'unit', -- unit | hour | month | project
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.business_products enable row level security;
create policy "business_products: owner all" on public.business_products
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
