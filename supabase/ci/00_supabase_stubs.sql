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

-- Mirrors the real implementation: PostgREST puts the verified JWT into
-- request.jwt.claims, and auth.uid() reads the subject out of it. Keeping that
-- shape here is what lets CI test policies AS a user rather than only assert
-- that they exist — with nothing set it returns null, so fail-closed checks
-- still hold.
create or replace function auth.uid () returns uuid
  language sql stable as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid
$$;

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
