-- ============================================================================
-- 018 — rate limiting that survives a serverless invocation.
--
-- src/lib/rate-limit.ts kept its counters in a module-level Map. On Vercel each
-- function invocation may get a fresh isolate, so the counter is effectively
-- always 1 and the limiter does nothing at all. It was also applied to only one
-- endpoint.
--
-- Meanwhile public.partner_applications accepts unauthenticated INSERT with
-- `with check (true)` and no limit, CAPTCHA or length cap — so anyone can flood
-- the admin inbox, and BizReady becomes the custodian of whatever third-party
-- personal data is pushed into it.
--
-- A Postgres table is the right store here: the app already has one, the volumes
-- are tiny, and correctness matters more than the microseconds a Redis hop would
-- save. The counter is incremented atomically inside a function so two
-- concurrent requests cannot both read the same count and both pass.
-- ============================================================================

begin;

create table if not exists public.rate_limits (
  -- "action:identifier", e.g. "register:203.0.113.7"
  key text not null,
  -- start of the fixed window this row counts
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies at all: only the service role touches this, so RLS denies every
-- anon/authenticated path by default. A user must never be able to read or
-- reset their own counter.

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

/**
 * Atomically counts a hit and reports whether it is allowed.
 *
 * The whole point of doing this in the database is the atomicity: the previous
 * in-memory version read, incremented and wrote in three steps, so two
 * simultaneous requests could both observe count = limit - 1 and both proceed.
 * `insert ... on conflict do update` with a returning clause makes the read and
 * the write one statement.
 */
create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, current_count integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- Fixed windows, aligned to the epoch so every instance computes the same
  -- boundary from the same inputs without coordinating.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning public.rate_limits.count into v_count;

  return query
  select
    v_count <= p_limit,
    v_count,
    greatest(
      0,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer
    );
end
$$;

/** Housekeeping: drop windows nothing can consult any more. */
create or replace function public.rate_limit_prune(p_older_than_seconds integer default 86400)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - make_interval(secs => p_older_than_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

commit;
