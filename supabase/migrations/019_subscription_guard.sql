-- ============================================================================
-- 019 — make subscription state unwritable by anyone except the billing webhook.
--
-- `businesses` has an owner UPDATE policy, which it needs: the user edits their
-- own business name, tax file numbers and bank details. But that same policy
-- also covers subscription_tier and subscription_until, and Postgres RLS is
-- row-level — it cannot say "you may update these nine columns but not those
-- two".
--
-- The application allowlist added earlier (BUSINESS_CARD_FIELDS in actions.ts)
-- closes the known path, and that matters. But it is one `.update()` away from
-- being bypassed again: a Server Action is a public POST endpoint, TypeScript
-- types are erased at runtime, and the next person to add a business-update
-- action has to remember the allowlist exists. Revenue protection should not
-- depend on remembering.
--
-- So the guard moves into the database, where it holds for every path — present
-- and future, application code or a leaked anon key. A BEFORE UPDATE trigger
-- rejects any change to the subscription columns unless the caller is the
-- service role, which only the verified billing webhook uses.
--
-- Also adds trial_used_at, so a trial can be granted once rather than being a
-- rolling free window (the defect the old self-serve startProTrial had: it was
-- re-callable indefinitely).
-- ============================================================================

begin;

alter table public.businesses
  add column if not exists trial_used_at timestamptz,
  -- The Stripe customer/subscription ids, so the webhook can reconcile without
  -- trusting anything the client sends.
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text;

create index if not exists businesses_billing_customer_idx
  on public.businesses (billing_customer_id)
  where billing_customer_id is not null;

/**
 * Rejects a session-level change to subscription state.
 *
 * The check is on `current_user`, not on `auth.role()`. PostgREST issues
 * `SET LOCAL ROLE` from the SIGNED JWT, so current_user is 'service_role' for
 * the admin client, 'authenticated' for a logged-in session and 'anon'
 * otherwise — and a client cannot influence it without the signing secret.
 *
 * I checked this against the live database before relying on it: `auth.role()`
 * returns NULL on a direct connection with no JWT, so a guard built on it would
 * have rejected migrations and admin SQL as well. `current_user` resolves in
 * every context.
 *
 * `postgres` and `supabase_admin` are allowed through so a migration or a
 * deliberate admin fix is not locked out of its own table.
 *
 * Comparisons use `is distinct from` so a no-op UPDATE that happens to include
 * the column at its current value still passes — otherwise an ordinary "save my
 * business name" that sent the whole row would start failing.
 */
create or replace function public.guard_subscription_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if current_user::text in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.subscription_tier is distinct from old.subscription_tier then
    raise exception
      'subscription_tier is set by the billing webhook only (attempted % -> %)',
      old.subscription_tier, new.subscription_tier
      using errcode = '42501';
  end if;

  if new.subscription_until is distinct from old.subscription_until then
    raise exception 'subscription_until is set by the billing webhook only'
      using errcode = '42501';
  end if;

  if new.trial_used_at is distinct from old.trial_used_at then
    raise exception 'trial_used_at is set by the billing webhook only'
      using errcode = '42501';
  end if;

  if new.billing_customer_id is distinct from old.billing_customer_id
     or new.billing_subscription_id is distinct from old.billing_subscription_id then
    raise exception 'billing identifiers are set by the billing webhook only'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists businesses_subscription_guard on public.businesses;
create trigger businesses_subscription_guard
  before update on public.businesses
  for each row execute function public.guard_subscription_columns();

comment on trigger businesses_subscription_guard on public.businesses is
  'Revenue guard. RLS is row-level and cannot protect individual columns, so '
  'this rejects any session-level write to subscription_tier, '
  'subscription_until, trial_used_at or the billing identifiers. Only the '
  'service role — i.e. the verified billing webhook — may change them.';

commit;
