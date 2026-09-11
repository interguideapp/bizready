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
