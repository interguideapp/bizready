-- Can push actually reach anyone?
--
-- pushConfigured() answers "are the VAPID keys set", and that was standing in
-- for "will a push notification arrive". It is not the same question, and the
-- gap is invisible from the environment: measured on this database, both
-- businesses had notify_push = false and ZERO rows in push_subscriptions while
-- the keys were the recommended next configuration step. Keys plus no
-- subscribed browser sends nothing, for ever, with no error anywhere -- the
-- same shape as the empty reminder_log that a missing mail provider produced.
--
-- The user-facing surfaces answer this per business, under RLS, from their own
-- session. This function exists for the other half: an operator on /admin who
-- has just pasted the keys and needs to know whether any device is listening.
--
-- A count and nothing else. No endpoint, no business id, no user id -- so the
-- answer cannot identify a tenant even though it aggregates across all of
-- them. Admin-gated anyway, on the same admin_users check every other admin
-- read uses, because an aggregate over every tenant is not a user's business.
--
-- security definer for the same reason sweep_health() is: push_subscriptions
-- is owner-scoped by RLS, so an admin's own session would count only their own
-- devices and report a confident, wrong zero.
begin;

create or replace function public.push_reach ()
  returns bigint
  language sql
  stable
  security definer
  set search_path = public
as $fn$
  select case
    when exists (select 1 from public.admin_users a where a.user_id = auth.uid())
      then (
        -- Only subscriptions whose business has push switched ON count: a
        -- stored endpoint for a business that has since turned push off is
        -- not a route the sender will ever use.
        select count(*)
        from public.push_subscriptions p
        join public.businesses b on b.id = p.business_id
        where b.notify_push is true
      )
    else null
  end;
$fn$;

comment on function public.push_reach () is
  'Admin-only count of push subscriptions belonging to businesses that have '
  'push enabled -- i.e. how many devices the reminder sweep could actually '
  'send to. Returns null to non-admins. Aggregate only: it names no tenant.';

commit;
