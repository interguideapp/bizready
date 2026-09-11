-- ============================================================================
-- 017 — the privacy obligations the product teaches but did not implement.
--
-- BizReady ships a critical, statute-backed task titled
-- "מדיניות פרטיות תואמת תיקון 13" instructing the user to honour THEIR
-- customers' rights of access, correction and erasure. An exhaustive search of
-- the codebase found no delete path, no export and no retention window.
--
-- Worse, synced_documents.customer_name and synced_contacts.name hold the
-- user's OWN customers' personal data — ingested by default, because
-- integrations/registry.ts marks those fields default: true — and those tables
-- had NO DELETE POLICY AT ALL. So a user could not erase their customers' data
-- even by asking the product to, and nothing ever expired it.
--
-- This migration gives the owner the right to erase, and gives the data an end
-- date. The application-side export and account deletion ship alongside it.
--
-- Additive: three DELETE policies, one index. No data is read or removed by the
-- migration itself.
-- ============================================================================

begin;

-- ---------- the owner may erase ingested customer data ----------
-- Read and insert policies already exist; DELETE was simply missing, which
-- meant RLS denied it silently and the user had no route to erasure.
drop policy if exists "synced_documents: owner delete" on public.synced_documents;
create policy "synced_documents: owner delete" on public.synced_documents
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "synced_contacts: owner delete" on public.synced_contacts;
create policy "synced_contacts: owner delete" on public.synced_contacts
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "synced_orders: owner delete" on public.synced_orders;
create policy "synced_orders: owner delete" on public.synced_orders
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid ())
  );

-- ---------- make the retention sweep cheap to run ----------
-- The nightly sweep deletes rows older than the retention window; without these
-- it would scan the whole table every night.
create index if not exists synced_documents_retention_idx
  on public.synced_documents (issued_at);

create index if not exists synced_contacts_retention_idx
  on public.synced_contacts (created_at);

-- ---------- say the policy out loud, next to the data ----------
comment on table public.synced_documents is
  'Ingested from the user''s invoicing provider. Contains the USER''S CUSTOMERS'' '
  'personal data (customer_name), so the business owner is the controller and we '
  'are the processor. Retention: see SYNCED_DATA_RETENTION_DAYS in '
  'src/lib/privacy.ts; rows past the window are removed by the nightly sweep. '
  'The owner can erase rows directly, and account deletion removes all of them.';

comment on table public.synced_contacts is
  'Ingested contact records belonging to the user''s customers. Same controller/'
  'processor split and the same retention window as synced_documents.';

commit;
