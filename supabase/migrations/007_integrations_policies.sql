-- Owner-session writes for the integration pipeline (CSV import, manual sync).
-- The inbound webhook still runs with the service role (no user session).

create policy "synced_documents: owner write" on public.synced_documents
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "synced_contacts: owner write" on public.synced_contacts
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "synced_orders: owner write" on public.synced_orders
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "sync_metrics: owner write" on public.sync_metrics
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "sync_metrics: owner update" on public.sync_metrics
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "sync_errors: owner insert" on public.sync_errors
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
create policy "notifications: owner insert" on public.notifications
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );
