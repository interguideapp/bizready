-- BizReady initial schema
-- All user-facing tables are protected by RLS; content tables are world-readable.

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: owner read" on public.profiles
  for select using (auth.uid () = id);
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid () = id);
create policy "profiles: owner insert" on public.profiles
  for insert with check (auth.uid () = id);

-- auto-create profile on signup
create function public.handle_new_user ()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- ============ businesses ============
create table public.businesses (
  id uuid primary key default gen_random_uuid (),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  entity_type text not null default 'osek_patur', -- osek_patur | osek_murshe
  field text,                                      -- activity field slug
  started_at date,                                 -- business start date (for relative deadlines)
  onboarding_answers jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  -- business card details (התיק הדיגיטלי)
  dealer_number text,      -- מספר עוסק
  vat_file text,           -- תיק מע"מ
  income_tax_file text,    -- תיק מס הכנסה
  bituach_leumi_file text, -- תיק ביטוח לאומי
  bank_name text,
  bank_branch text,
  bank_account text,
  accountant_name text,
  accountant_phone text,
  accountant_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id) -- v1: one business per user
);
alter table public.businesses enable row level security;
create policy "businesses: owner all" on public.businesses
  for all using (auth.uid () = owner_id) with check (auth.uid () = owner_id);

-- ============ content: categories & task templates ============
create table public.categories (
  id text primary key,          -- slug e.g. 'legal-setup'
  title text not null,
  description text not null default '',
  icon text not null default '',
  sort_order int not null default 0
);
alter table public.categories enable row level security;
create policy "categories: public read" on public.categories for select using (true);

create table public.task_templates (
  id text primary key,          -- stable slug e.g. 'open-vat-file'
  category_id text not null references public.categories (id),
  title text not null,
  why text not null,
  steps text not null,          -- markdown
  official_links jsonb not null default '[]'::jsonb, -- [{label, url}]
  docs_needed jsonb not null default '[]'::jsonb,    -- [string]
  est_cost text,
  est_time text,
  applies_when jsonb not null default '{}'::jsonb,
  depends_on jsonb not null default '[]'::jsonb,     -- [template_id]
  deadline_days int,            -- relative to business start / onboarding
  recurrence text,              -- null | monthly | bimonthly | yearly
  priority text not null default 'important',        -- critical | important | recommended
  source_url text,
  review_status text not null default 'reviewed',
  last_reviewed date,
  sort_order int not null default 0
);
alter table public.task_templates enable row level security;
create policy "task_templates: public read" on public.task_templates for select using (true);

-- ============ business tasks (instances) ============
create table public.business_tasks (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  template_id text not null references public.task_templates (id),
  status text not null default 'todo',  -- todo | in_progress | done | not_relevant
  due_date date,
  completed_at timestamptz,
  notes text,
  is_relevant boolean not null default true, -- false when answers change and rule no longer applies
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, template_id)
);
alter table public.business_tasks enable row level security;
create policy "business_tasks: owner all" on public.business_tasks
  for all using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid ()
    )
  );

-- ============ documents (ארכיון) ============
create table public.documents (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  task_id uuid references public.business_tasks (id) on delete set null,
  category text not null default 'other', -- registration | tax | insurance | agreements | other
  name text not null,
  storage_path text not null,
  mime_type text,
  expires_at date,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "documents: owner all" on public.documents
  for all using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid ()
    )
  );

-- ============ marketplace infrastructure (offers live in phase 2) ============
create table public.partners (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  contact text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
create policy "partners: public read active" on public.partners for select using (is_active);

create table public.offers (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid references public.partners (id) on delete cascade,
  template_id text references public.task_templates (id),  -- offer shown inside this task
  category_id text references public.categories (id),      -- or per-category
  title text not null,
  description text not null default '',
  cta_label text not null default '',
  url text,
  coupon_code text,
  commission_type text, -- referral | cpa | lead | own_product
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create policy "offers: public read active" on public.offers for select using (is_active);

create table public.offer_clicks (
  id uuid primary key default gen_random_uuid (),
  offer_id uuid not null references public.offers (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  clicked_at timestamptz not null default now()
);
alter table public.offer_clicks enable row level security;
create policy "offer_clicks: owner insert" on public.offer_clicks
  for insert with check (
    business_id is null or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid ()
    )
  );

-- ============ storage bucket for documents ============
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

create policy "docs storage: owner read" on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername (name))[1] = auth.uid ()::text
  );
create policy "docs storage: owner insert" on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername (name))[1] = auth.uid ()::text
  );
create policy "docs storage: owner delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- ============ updated_at triggers ============
create function public.touch_updated_at ()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at ();
create trigger business_tasks_touch before update on public.business_tasks
  for each row execute function public.touch_updated_at ();
