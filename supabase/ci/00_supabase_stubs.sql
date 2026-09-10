-- Minimal stand-ins for the Supabase-managed schemas, so the migration set can
-- be applied to a clean vanilla Postgres in CI. This exists to catch the class
-- of bug that shipped once already: a migration referencing a table that no
-- migration creates (public.notifications), which aborted the whole file and
-- silently took five unrelated policies with it.
create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid ()
);

-- RLS policies reference this; in CI it just needs to exist and be stable.
create or replace function auth.uid () returns uuid
  language sql stable as $$ select null::uuid $$;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid (),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername (name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
