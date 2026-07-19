-- Username/password sign-up: profiles need a username the registration route can set.
-- Usernames are stored normalized (lowercase) by the app; the DB enforces shape
-- and uniqueness so two accounts can never claim the same name.

alter table public.profiles
  add column username text;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

-- NULL is allowed for magic-link / OAuth users who have no username.
create unique index profiles_username_key on public.profiles (username);
