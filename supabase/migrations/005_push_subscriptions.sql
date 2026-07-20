-- Web push subscriptions (one row per device/browser).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: owner all" on public.push_subscriptions
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

alter table public.businesses add column notify_push boolean not null default false;
