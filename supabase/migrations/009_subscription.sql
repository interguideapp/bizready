-- Subscription tier for the Compliance Guardian (paid) features.
alter table public.businesses
  add column subscription_tier text not null default 'free',  -- free | pro
  add column subscription_until timestamptz;
