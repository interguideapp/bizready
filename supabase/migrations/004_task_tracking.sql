-- Richer tracking for tasks that take time, plus proof-of-completion.

alter table public.business_tasks
  add column completion_data jsonb not null default '{}'::jsonb,
  add column follow_up_date date,
  add column waiting_for text;

-- Activity log: every status change / completion, so the user can see what happened when.
create table public.task_events (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  task_id uuid not null references public.business_tasks (id) on delete cascade,
  template_id text not null,
  kind text not null,              -- status_change | completed | reopened | note | follow_up_set
  from_status text,
  to_status text,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.task_events enable row level security;
create policy "task_events: owner read" on public.task_events
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "task_events: owner insert" on public.task_events
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create index task_events_business_idx on public.task_events (business_id, created_at desc);
