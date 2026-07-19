-- Username/password accounts use an internal, non-deliverable auth identifier.
-- Public usernames remain unique case-insensitively for display and future lookup.
alter table public.profiles add column username text;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

create unique index profiles_username_unique_lower
  on public.profiles (lower(username))
  where username is not null;
