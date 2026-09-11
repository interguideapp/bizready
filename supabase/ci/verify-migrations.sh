#!/usr/bin/env bash
# Apply every migration, in order, to a clean database. Fails on the FIRST
# error, so a migration that references a missing object can never ship again.
set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"
psql_run() { psql "$DB_URL" -v ON_ERROR_STOP=1 --quiet -f "$1"; }

echo "→ stubbing Supabase-managed schemas"
psql_run supabase/ci/00_supabase_stubs.sql

for f in $(ls supabase/migrations/*.sql | sort); do
  echo "→ applying $(basename "$f")"
  psql_run "$f"
done

echo "→ asserting the tables the application actually reads exist"
psql "$DB_URL" -v ON_ERROR_STOP=1 --quiet <<'SQL'
do $$
declare
  missing text := '';
  t text;
  required text[] := array[
    'profiles','businesses','business_tasks','documents','task_events',
    'task_checklist_items','business_products','business_costs',
    'notifications','reminder_log','push_subscriptions',
    'integration_connections','synced_documents','synced_contacts',
    'synced_orders','sync_metrics','sync_errors',
    'partners','offers','offer_clicks','partner_applications',
    'admin_users','partner_leads'
  ];
begin
  foreach t in array required loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      missing := missing || ' ' || t;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'missing tables:%', missing;
  end if;
end $$;

-- columns the reminder cron and settings screen depend on
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name='businesses' and column_name='notify_email')
  then raise exception 'businesses.notify_email is missing'; end if;
  if not exists (select 1 from information_schema.columns
                 where table_name='businesses' and column_name='whatsapp_phone')
  then raise exception 'businesses.whatsapp_phone is missing'; end if;
end $$;

-- 014: evidence integrity. The hash chain is what makes the trail tamper-evident,
-- so a migration set that lost the trigger would ship an audit log that only
-- looks append-only.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name='task_events' and column_name='hash')
  then raise exception 'task_events.hash is missing — the evidence chain is not installed'; end if;
  if not exists (select 1 from information_schema.columns
                 where table_name='task_events' and column_name='prev_hash')
  then raise exception 'task_events.prev_hash is missing'; end if;
  if not exists (select 1 from information_schema.columns
                 where table_name='task_events' and column_name='actor_id')
  then raise exception 'task_events.actor_id is missing — events would be unattributed'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'task_events_chain_tr')
  then raise exception 'the task_events hash-chain trigger is missing'; end if;
  if not exists (select 1 from information_schema.columns
                 where table_name='task_events' and column_name='seq')
  then raise exception 'task_events.seq is missing — the chain would have no unambiguous order'; end if;
end $$;

-- 015: the dismissal split. Without these, task-status.ts reads every dismissal
-- as legacy/unclarified and no user can ever record "handled externally".
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name='business_tasks' and column_name='dismissal')
  then raise exception 'business_tasks.dismissal is missing'; end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'business_tasks_dismissal_valid')
  then raise exception 'the dismissal value check constraint is missing'; end if;
end $$;

-- 016: no foreign key may point at the unused task_templates mirror. One did,
-- and because that mirror had drifted to 62 rows against the 70 the code ships,
-- it rejected the bulk plan insert for every company and partnership — breaking
-- onboarding for two of the four entity types.
do $$
declare offenders text := '';
begin
  select coalesce(string_agg(conname, ' '), '') into offenders
  from pg_constraint where confrelid = 'public.task_templates'::regclass;
  if offenders <> '' then
    raise exception 'foreign keys still point at the unused task_templates mirror:%', offenders;
  end if;
end $$;

-- The chain must actually chain. Asserting the columns exist is not enough: a
-- trigger that computed a constant, or looked up the wrong predecessor, would
-- pass every structural check above and prove nothing in production.
--
-- Both events go in inside ONE transaction on purpose. They therefore share
-- created_at exactly, which is precisely the case that used to fall back to
-- ordering by a random uuid.
do $$
declare usr uuid; biz uuid; tsk uuid; h1 text; h2 text; p2 text;
begin
  insert into auth.users default values returning id into usr;
  insert into public.profiles (id) values (usr);

  insert into public.businesses (owner_id, name, entity_type)
  values (usr, 'ci-chain-probe', 'osek_patur')
  returning id into biz;

  insert into public.business_tasks (business_id, template_id, status)
  values (biz, 'open-vat-file', 'todo') returning id into tsk;

  insert into public.task_events (business_id, task_id, template_id, kind)
  values (biz, tsk, 'open-vat-file', 'status_change') returning hash into h1;

  insert into public.task_events (business_id, task_id, template_id, kind)
  values (biz, tsk, 'open-vat-file', 'status_change')
  returning hash, prev_hash into h2, p2;

  if h1 is null or h2 is null then
    raise exception 'the chain trigger did not compute a hash';
  end if;
  if p2 is distinct from h1 then
    raise exception 'chain broken: prev_hash % does not match the previous hash %', p2, h1;
  end if;
  if h1 = h2 then
    raise exception 'two events hashed identically — the chain proves nothing';
  end if;

  -- clean up: cascades through businesses -> tasks -> events
  delete from auth.users where id = usr;
end $$;

-- 017/018/019: the hardening migrations.
do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename = 'synced_documents' and cmd = 'DELETE')
  then raise exception 'synced_documents has no DELETE policy — the user cannot erase their customers data'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='rate_limits')
  then raise exception 'rate_limits is missing — the limiter has no durable store'; end if;
  if not exists (select 1 from pg_proc where proname = 'rate_limit_hit')
  then raise exception 'rate_limit_hit() is missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'businesses_subscription_guard')
  then raise exception 'the subscription guard trigger is missing — Pro is grantable from a session'; end if;
end $$;

-- The rate limiter must actually count. Two hits inside one window have to
-- return 1 then 2, or concurrent requests could both pass the limit.
do $$
declare a integer; b integer; allowed_b boolean;
begin
  select current_count into a from public.rate_limit_hit('ci-probe', 1, 60);
  select current_count, allowed into b, allowed_b from public.rate_limit_hit('ci-probe', 1, 60);
  if a <> 1 or b <> 2 then
    raise exception 'rate_limit_hit did not increment: got % then %', a, b;
  end if;
  if allowed_b then
    raise exception 'rate_limit_hit allowed a second hit against a limit of 1';
  end if;
  delete from public.rate_limits where key = 'ci-probe';
end $$;

-- 020/021: billing idempotency and source watching.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='billing_events')
  then raise exception 'billing_events is missing — a retried Stripe delivery would double-apply'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='source_fingerprints')
  then raise exception 'source_fingerprints is missing — nothing detects a changed source'; end if;
  -- Without a read policy the admin console queries it, gets nothing, and
  -- renders a silent false all-clear.
  if not exists (select 1 from pg_policies
                 where tablename = 'source_fingerprints' and cmd = 'SELECT')
  then raise exception 'source_fingerprints has no SELECT policy — the console would show a false all-clear'; end if;
  -- ...but it must NOT be writable from a session.
  if exists (select 1 from pg_policies
             where tablename = 'source_fingerprints' and cmd in ('INSERT','UPDATE','DELETE'))
  then raise exception 'source_fingerprints is session-writable — only the watcher may record fingerprints'; end if;
  if exists (select 1 from pg_policies where tablename = 'billing_events')
  then raise exception 'billing_events has a policy — billing history must be service-role only'; end if;
end $$;

-- 022: membership. This is the migration where a mistake means cross-tenant
-- access, so the checks are behavioural rather than structural.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_business_member')
  then raise exception 'is_business_member() is missing'; end if;
  if not exists (select 1 from pg_proc where proname = 'can_edit_business')
  then raise exception 'can_edit_business() is missing'; end if;
  -- The owner policies must still be there: 022 is additive, and if it replaced
  -- them the owner path would now depend on the membership code being right.
  if not exists (select 1 from pg_policies
                 where tablename = 'business_tasks' and policyname like '%owner%')
  then raise exception 'the owner policies on business_tasks were replaced, not added to'; end if;
  -- A viewer must not be able to write, so there must be no membership-wide
  -- write policy: only can_edit_business ones.
  if exists (select 1 from pg_policies
             where tablename = 'business_tasks'
               and cmd in ('INSERT','UPDATE')
               and qual like '%is_business_member%')
  then raise exception 'business_tasks has a write policy gated on mere membership — a viewer could edit'; end if;
  -- task_events is append-only for everyone, including an accountant.
  if exists (select 1 from pg_policies
             where tablename = 'task_events' and cmd in ('UPDATE','DELETE'))
  then raise exception 'task_events is no longer append-only — the audit trail is editable'; end if;
end $$;

-- The membership functions must actually discriminate. Two businesses, one
-- member on the first: the helper has to say yes to one and no to the other.
do $$
declare
  u1 uuid; u2 uuid; b1 uuid; b2 uuid;
begin
  insert into auth.users default values returning id into u1;
  insert into auth.users default values returning id into u2;
  insert into public.profiles (id) values (u1), (u2);

  insert into public.businesses (owner_id, name) values (u1, 'ci-a') returning id into b1;
  insert into public.businesses (owner_id, name) values (u2, 'ci-b') returning id into b2;

  insert into public.business_members
    (business_id, user_id, invited_email, role, invited_by, invite_token, accepted_at)
  values (b1, u2, 'ci@example.com', 'viewer', u1, 'ci-token-1', now());

  -- auth.uid() is null in this context, so the helpers must return false rather
  -- than erroring or defaulting to true. A membership check that fails open is
  -- the whole risk of this migration.
  if public.is_business_member(b1) then
    raise exception 'is_business_member returned true with no authenticated user';
  end if;
  if public.can_edit_business(b1) then
    raise exception 'can_edit_business returned true with no authenticated user';
  end if;

  -- A revoked membership must stop counting.
  update public.business_members set revoked_at = now() where business_id = b1;
  if exists (
    select 1 from public.business_members
    where business_id = b1 and revoked_at is null and accepted_at is not null
  ) then
    raise exception 'revoking a membership did not clear it';
  end if;

  delete from auth.users where id in (u1, u2);
  if b2 is null then raise exception 'unreachable'; end if;
end $$;

-- every public table must have RLS enabled
do $$
declare unprotected text := '';
begin
  select coalesce(string_agg(c.relname, ' '), '') into unprotected
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if unprotected <> '' then
    raise exception 'tables without RLS:%', unprotected;
  end if;
end $$;
SQL

echo "✓ migrations apply cleanly and the expected schema is present"
