-- ============================================================================
-- 021 — remember what each official source looked like last time.
--
-- review-queue.ts answers "what have we not checked lately", which is a
-- calendar question. It cannot catch a rule that changed the week after it was
-- reviewed. This table is the other half: a fingerprint per source URL, so the
-- weekly watcher can say "this page moved, go read it".
--
-- The landing page already tells users the product is
-- "מבוסס על מקורות רשמיים ומתעדכן כשהחוק משתנה". This is the mechanism that
-- makes the second half of that sentence true.
--
-- Service-role only: the watcher writes it, the admin console reads it through
-- server code. No session policy, so RLS denies everything else by default.
-- ============================================================================

begin;

create table if not exists public.source_fingerprints (
  url text primary key,
  -- sha256 of the NORMALISED page text (see src/lib/content/source-watch.ts —
  -- scripts, dates, session ids and markup are stripped first, or the hash
  -- would change on every fetch and the watcher would be pure noise).
  checksum text not null,
  -- Length of that normalised text. The corroborating signal: a different
  -- checksum within a couple of percent of the same length is chrome wobble,
  -- not a redrafted rule.
  length integer not null,
  checked_at timestamptz not null default now(),
  -- Set when a change is detected and cleared when a human confirms it. This is
  -- the review queue for "the source moved", as opposed to "this is old".
  changed_at timestamptz,
  acknowledged_at timestamptz
);

alter table public.source_fingerprints enable row level security;

-- Admins may READ. Without this the console would query the table through the
-- admin's own session, get nothing back because RLS denied it, and render "no
-- sources changed" — a silent false all-clear, which is the exact failure this
-- codebase has spent this whole pass removing. Writes stay service-role only:
-- only the watcher may record a fingerprint.
drop policy if exists "source_fingerprints: admin read" on public.source_fingerprints;
create policy "source_fingerprints: admin read" on public.source_fingerprints
  for select using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid ())
  );

create index if not exists source_fingerprints_pending_idx
  on public.source_fingerprints (changed_at)
  where changed_at is not null and acknowledged_at is null;

comment on table public.source_fingerprints is
  'One row per watched official page. A changed checksum means LOOK, never '
  '"the law changed" — a hash cannot tell a redrafted regulation from a '
  'reorganised web page, and content is never auto-updated from it.';

commit;
