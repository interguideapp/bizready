-- Personal checklist inside a task + files attached to a specific step.

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  business_task_id uuid not null references public.business_tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.task_checklist_items enable row level security;
create policy "checklist: owner all" on public.task_checklist_items
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create index checklist_task_idx on public.task_checklist_items (business_task_id, sort_order);

-- a document may belong to a specific checklist step (still filed in the archive too)
alter table public.documents
  add column checklist_item_id uuid references public.task_checklist_items (id) on delete set null;
