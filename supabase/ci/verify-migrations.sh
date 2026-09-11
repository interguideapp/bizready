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

  -- ---- the half that actually matters: WHO gets what ----
  -- Fail-closed is proved above. This proves the grant is not too wide, by
  -- acting as each party in turn. Without this, "viewer = read only" is a
  -- claim in a comment rather than a tested property, and a viewer who could
  -- complete a statutory filing would write into someone else's hash-chained
  -- audit trail.
  perform set_config('request.jwt.claims', json_build_object('sub', u1)::text, true);
  if not public.is_business_member(b1) then
    raise exception 'the OWNER is not a member of their own business';
  end if;
  if not public.can_edit_business(b1) then
    raise exception 'the OWNER cannot edit their own business — 022 broke the owner path';
  end if;
  if public.is_business_member(b2) then
    raise exception 'CROSS-TENANT: u1 is a member of a business they have no relationship to';
  end if;

  -- u2 holds a viewer membership on b1 (inserted above).
  perform set_config('request.jwt.claims', json_build_object('sub', u2)::text, true);
  if not public.is_business_member(b1) then
    raise exception 'a VIEWER cannot read the business they were invited to';
  end if;
  if public.can_edit_business(b1) then
    raise exception 'a VIEWER can edit — read-only access does not mean read-only';
  end if;

  -- Promote the same row to accountant: now editing is the point.
  update public.business_members set role = 'accountant'
    where business_id = b1 and user_id = u2;
  if not public.can_edit_business(b1) then
    raise exception 'an ACCOUNTANT cannot edit — the collaborator cannot do the work';
  end if;

  -- An invitation that was never accepted grants nothing, or an emailed token
  -- alone would be access.
  update public.business_members set accepted_at = null
    where business_id = b1 and user_id = u2;
  if public.is_business_member(b1) then
    raise exception 'an UNACCEPTED invitation already grants access';
  end if;
  update public.business_members set accepted_at = now()
    where business_id = b1 and user_id = u2;

  -- And revocation must take effect for the helpers, not merely set a column.
  update public.business_members set revoked_at = now()
    where business_id = b1 and user_id = u2;
  if public.is_business_member(b1) then
    raise exception 'a REVOKED member still has read access';
  end if;
  if public.can_edit_business(b1) then
    raise exception 'a REVOKED accountant can still edit';
  end if;
  update public.business_members set revoked_at = null
    where business_id = b1 and user_id = u2;

  perform set_config('request.jwt.claims', null, true);

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

-- 023: the user-facing rule changelog. The notice says "the law changed", so
-- a session must never be able to publish one.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='content_changelog')
  then raise exception 'content_changelog is missing — users never learn a rule changed'; end if;
  if not exists (select 1 from pg_policies
                 where tablename = 'content_changelog' and cmd = 'SELECT')
  then raise exception 'content_changelog has no read policy — the notices would be invisible'; end if;
  if exists (select 1 from pg_policies
             where tablename = 'content_changelog' and cmd in ('INSERT','UPDATE','DELETE','ALL'))
  then raise exception 'content_changelog is session-writable — a user could publish a fake law change'; end if;
  -- Per-user read receipts, on the other hand, must be self-writable.
  if not exists (select 1 from pg_policies where tablename = 'content_changelog_reads')
  then raise exception 'content_changelog_reads has no policy — nobody could dismiss a notice'; end if;
end $$;

-- 024: a sync error can be resolved but not rewritten. 006 granted an
-- unrestricted owner UPDATE, so a session could edit the message describing
-- what the integration failed to reconcile.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'sync_errors_guard')
  then raise exception 'the sync_errors guard is missing — the failure record is editable'; end if;
end $$;

-- 025 + 026: the typed step-progress column must exist, and no row may still
-- carry the key the cutover was supposed to consume. The re-run behaviour is
-- checked further down, by applying the real migration files a second time.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='business_tasks'
                   and column_name='steps_done')
  then raise exception 'business_tasks.steps_done is missing — the 014/025 cutover is incomplete'; end if;

  if exists (select 1 from public.business_tasks where completion_data ? '__steps_done') then
    raise exception '__steps_done survived the migration set — 025/026 did not complete';
  end if;
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

# ---------------------------------------------------------------------------
# The step-progress cutover (025 + 026) must survive being applied twice.
#
# This re-applies the REAL migration files rather than a copy of their SQL, so
# editing a migration cannot leave a test that still passes. It matters because
# 025's guard is "the column is empty", which cannot distinguish "never
# migrated" from "the user unticked every step" — the first version shipped
# claiming an idempotency it did not have, and would have resurrected cleared
# progress on any replay.
echo "→ seeding a pre-cutover row"
psql "$DB_URL" -v ON_ERROR_STOP=1 --quiet <<'SQL'
do $$
declare u uuid; b uuid;
begin
  insert into auth.users default values returning id into u;
  insert into public.profiles (id) values (u);
  insert into public.businesses (owner_id, name) values (u, 'ci-steps') returning id into b;
  -- pre-cutover shape: bookkeeping key beside real completion evidence
  insert into public.business_tasks
    (business_id, template_id, status, completion_data, steps_done)
  values (
    b, 'open-vat-file', 'in_progress',
    '{"__steps_done": [0, 2], "confirmation": "12345"}'::jsonb,
    '{}'::int[]
  );
end $$;
SQL

echo "→ re-applying 025 and 026 over existing data"
psql_run supabase/migrations/025_steps_done_cutover.sql
psql_run supabase/migrations/026_consume_legacy_steps_key.sql

psql "$DB_URL" -v ON_ERROR_STOP=1 --quiet <<'SQL'
do $$
declare t uuid; sd int[]; cd jsonb;
begin
  select id into t from public.business_tasks where template_id = 'open-vat-file'
    and business_id in (select id from public.businesses where name = 'ci-steps');
  if t is null then raise exception 'the seeded row vanished'; end if;

  select steps_done, completion_data into sd, cd from public.business_tasks where id = t;

  if sd <> '{0,2}'::int[] then
    raise exception '025 did not backfill steps_done from the legacy key: %', sd;
  end if;
  if cd ? '__steps_done' then
    raise exception '026 did not consume the legacy key: %', cd;
  end if;
  if cd ->> 'confirmation' is distinct from '12345' then
    raise exception 'the cutover destroyed completion evidence: %', cd;
  end if;

  -- THE POINT: the user clears every step, then the pair is applied again.
  -- Before 026 this restored {0,2}, silently contradicting the user.
  update public.business_tasks set steps_done = '{}'::int[] where id = t;
end $$;
SQL

psql_run supabase/migrations/025_steps_done_cutover.sql
psql_run supabase/migrations/026_consume_legacy_steps_key.sql

psql "$DB_URL" -v ON_ERROR_STOP=1 --quiet <<'SQL'
do $$
declare t uuid; sd int[];
begin
  select id into t from public.business_tasks where template_id = 'open-vat-file'
    and business_id in (select id from public.businesses where name = 'ci-steps');
  select steps_done into sd from public.business_tasks where id = t;
  if sd <> '{}'::int[] then
    raise exception
      're-running the cutover resurrected progress the user had cleared: %', sd;
  end if;

  delete from public.business_tasks where id = t;
  delete from auth.users where id in (
    select owner_id from public.businesses where name = 'ci-steps'
  );
end $$;
SQL

echo "✓ the step-progress cutover is idempotent over existing data"

echo "✓ migrations apply cleanly and the expected schema is present"
