-- ============================================================================
-- 020 — idempotency for the billing webhook.
--
-- Stripe retries on any non-2xx and can legitimately deliver the same event
-- more than once. Without a record of what has been handled, a retry re-runs
-- the write; and once trial_used_at is being stamped, a duplicate would also
-- reset it. Recording the event id first turns a duplicate into a no-op.
--
-- Service-role only: RLS on, no policies, so no session can read the billing
-- log or forge an entry to make a real event look already-handled.
-- ============================================================================

begin;

create table if not exists public.billing_events (
  -- Stripe's own event id (evt_...). The primary key IS the idempotency key.
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;

create index if not exists billing_events_received_idx
  on public.billing_events (received_at);

comment on table public.billing_events is
  'Idempotency log for the Stripe webhook. The primary key is Stripe''s event '
  'id, so a retried delivery collides and is skipped. Service-role only: a '
  'session must not be able to read billing history or pre-insert an id to make '
  'a genuine event look already-processed.';

commit;
