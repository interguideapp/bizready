-- Integration hub: one lean data layer every external system flows through.

create table public.integration_connections (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null,            -- registry id, e.g. 'greeninvoice' | 'crm-webhook'
  category text not null,            -- invoicing|crm|ecommerce|payments|payroll|accounting|other
  mode text not null,                -- api | webhook | csv
  -- NOTE: credentials rest in Postgres under owner-only RLS; upgrade path: Supabase Vault
  credentials jsonb not null default '{}'::jsonb,
  field_map jsonb not null default '{}'::jsonb,
  webhook_token uuid not null default gen_random_uuid () unique,
  webhook_secret text,
  status text not null default 'connected',  -- connected | error | disabled
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.integration_connections enable row level security;
create policy "connections: owner all" on public.integration_connections
  for all using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create table public.synced_documents (
  id uuid primary key default gen_random_uuid (),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  external_id text not null,
  kind text not null default 'invoice',  -- invoice | receipt | credit | quote
  amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2),
  currency text not null default 'ILS',
  issued_at date,
  customer_name text,
  allocation_number text,
  status text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
alter table public.synced_documents enable row level security;
create policy "synced_documents: owner read" on public.synced_documents
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create table public.synced_contacts (
  id uuid primary key default gen_random_uuid (),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  external_id text not null,
  name text,
  stage text not null default 'lead',   -- lead | prospect | customer | lost
  source text,
  value numeric(12,2),
  occurred_at date,
  created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
alter table public.synced_contacts enable row level security;
create policy "synced_contacts: owner read" on public.synced_contacts
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create table public.synced_orders (
  id uuid primary key default gen_random_uuid (),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  external_id text not null,
  total numeric(12,2) not null default 0,
  status text,
  items_count int,
  placed_at date,
  created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
alter table public.synced_orders enable row level security;
create policy "synced_orders: owner read" on public.synced_orders
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create table public.sync_metrics (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  metric_date date not null,
  metric text not null,               -- revenue | documents | leads | orders | payments
  value numeric(14,2) not null default 0,
  category text,
  unique (business_id, metric_date, metric)
);
alter table public.sync_metrics enable row level security;
create policy "sync_metrics: owner read" on public.sync_metrics
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create table public.sync_errors (
  id uuid primary key default gen_random_uuid (),
  connection_id uuid references public.integration_connections (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null,
  message text not null,
  hint text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.sync_errors enable row level security;
create policy "sync_errors: owner read" on public.sync_errors
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "sync_errors: owner update" on public.sync_errors
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

create index synced_documents_business_date_idx on public.synced_documents (business_id, issued_at);
create index sync_metrics_business_idx on public.sync_metrics (business_id, metric_date);
create index sync_errors_open_idx on public.sync_errors (business_id) where resolved_at is null;
