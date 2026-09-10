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
