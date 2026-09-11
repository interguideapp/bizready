-- ============================================================================
-- 029 — did the scheduled work actually run?
--
-- Nothing recorded it. Four jobs are scheduled (reminders daily, invoice sync
-- daily, retention weekly, source-watch weekly) and the reminder sweep is what
-- sends every email, push and WhatsApp the product promises. If it stopped
-- there was no signal anywhere: not in the app, not for whoever operates it.
--
-- That is not hypothetical. The routes fail CLOSED on a missing CRON_SECRET —
-- correctly, since an unauthenticated sweep ran with the service-role key
-- across every tenant — which means a single absent environment variable
-- silently disables the entire reminder system. Three days of grouped runtime
-- logs for this project show 46 distinct request paths and not one
-- /api/cron/*, with the reminder job scheduled daily.
--
-- The user-facing surfaces were made independent of the sweep separately (the
-- notifications page derives what is due on page load rather than reading a
-- table the sweep fills). This table is the other half: making the failure
-- VISIBLE so it gets fixed, instead of being permanently worked around.
--
-- One row per attempt, not a single mutable "last run" row. A row per attempt
-- distinguishes "has not run" from "runs and fails every time", which have
-- different causes and different fixes — and a failure that overwrites the last
-- success would erase the evidence needed to tell them apart.
-- ============================================================================

begin;

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid (),
  -- Matches SweepJob in src/lib/heartbeat.ts. Deliberately unconstrained text:
  -- the job list lives in application code and changes without a migration,
  -- and a stale check constraint here would reject a legitimate new job.
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  -- Whatever the run wants remembered: counts sent, errors, tenants touched.
  -- Read by a human debugging a failure, so no shape is imposed.
  detail jsonb,
  constraint cron_runs_job_not_blank check (length(trim(job)) > 0)
);

alter table public.cron_runs enable row level security;

-- The heartbeat query is "the newest successful run per job", which this
-- supports directly. Partial, because unfinished and failed rows are never the
-- answer to that question.
create index if not exists cron_runs_last_ok_idx
  on public.cron_runs (job, finished_at desc)
  where ok is true;

-- Recent history for one job, for debugging a failing run.
create index if not exists cron_runs_recent_idx
  on public.cron_runs (job, started_at desc);

-- ---------- who can see this ----------
-- Admins read it; nobody writes through a session. The sweep runs with the
-- service role, which bypasses RLS, so it needs no policy — and giving sessions
-- a write path would let a client fake a heartbeat, which is worse than having
-- no heartbeat at all because it would read as healthy.
drop policy if exists "cron_runs: admin read" on public.cron_runs;
create policy "cron_runs: admin read" on public.cron_runs
  for select using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid ())
  );

/**
 * The newest successful run of each job, and the newest failure.
 *
 * SECURITY DEFINER so an ordinary session can learn whether the automation is
 * healthy without being able to read the table — `detail` can carry error text
 * and tenant counts, and the app only needs the timestamps. This is what lets
 * the product tell a user "automatic reminders may not be reaching you" instead
 * of leaving them to assume silence means safety.
 */
create or replace function public.sweep_health ()
  returns table (job text, last_ok_at timestamptz, last_failed_at timestamptz)
  language sql
  stable
  security definer
  set search_path = public
as $fn$
  select
    j.job,
    (select max(r.finished_at) from public.cron_runs r
      where r.job = j.job and r.ok is true),
    (select max(r.finished_at) from public.cron_runs r
      where r.job = j.job and r.ok is false)
  from (select distinct job from public.cron_runs) as j;
$fn$;

comment on table public.cron_runs is
  'One row per scheduled-job attempt. Written by the service role only; a '
  'session-writable heartbeat could be faked, which reads as healthy and is '
  'worse than no heartbeat. Read the summary via sweep_health().';

commit;
