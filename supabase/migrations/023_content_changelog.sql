-- ============================================================================
-- 023 — tell a user when a rule that affects THEM changed.
--
-- The source watcher (021) tells the TEAM that an official page moved. The
-- review queue tells them what is stale. Neither reaches the user, so the
-- product could update a deadline or an amount and the person whose filing
-- depends on it would never know it had changed.
--
-- DELIBERATELY HUMAN-AUTHORED. Entries are written after someone reads the
-- changed source and decides what it means — they are NOT generated from the
-- source-watch checksum. A checksum says "look at this page"; it cannot say
-- "the law changed", and auto-publishing "a rule affecting you changed" from a
-- diff signal would be the confident-but-unverified behaviour this whole pass
-- removed. The watcher's job is to make sure a human looks; this table is what
-- the human writes afterwards.
--
-- Targeting is by template_id, and delivery is scoped to businesses whose plan
-- actually contains that template. A blanket announcement would train users to
-- ignore these, which is worse than not sending them.
-- ============================================================================

begin;

create table if not exists public.content_changelog (
  id uuid primary key default gen_random_uuid (),
  -- Which task the change is about. Not a foreign key: task content lives in
  -- src/lib/content, and 016 removed the FKs to the unused task_templates
  -- mirror for exactly this reason.
  template_id text not null,
  -- One sentence, in Hebrew, written for a business owner rather than for us.
  summary text not null,
  /**
   * What actually changed. Drives how loudly it is shown:
   *   deadline  a date moved — the most consequential kind
   *   amount    a figure changed (a ceiling, a fee, a rate)
   *   rule      the substance of the obligation changed
   *   guidance  clarification; the duty itself is unchanged
   */
  change_kind text not null
    check (change_kind in ('deadline', 'amount', 'rule', 'guidance')),
  -- The official page the change was read from. Same standard as everything
  -- else: no claim without a source.
  source_url text not null,
  -- When the change takes effect, if the source says. Null when it is immediate
  -- or unstated — better null than a guessed date.
  effective_from date,
  published_at timestamptz not null default now(),
  constraint content_changelog_summary_not_blank check (length(trim(summary)) > 0)
);

alter table public.content_changelog enable row level security;

-- Everyone signed in may read it: it is a public statement about public law,
-- and scoping the READ would make the entries invisible to the very people the
-- table exists for. Writes are service-role only — a user must never be able
-- to publish a "the law changed" notice.
drop policy if exists "content_changelog: authenticated read" on public.content_changelog;
create policy "content_changelog: authenticated read" on public.content_changelog
  for select using (auth.uid () is not null);

create index if not exists content_changelog_recent_idx
  on public.content_changelog (published_at desc);

create index if not exists content_changelog_template_idx
  on public.content_changelog (template_id, published_at desc);

-- Per-user dismissal, so "I have read this" is remembered without deleting the
-- entry for everyone else.
create table if not exists public.content_changelog_reads (
  changelog_id uuid not null references public.content_changelog (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (changelog_id, user_id)
);

alter table public.content_changelog_reads enable row level security;

drop policy if exists "content_changelog_reads: own" on public.content_changelog_reads;
create policy "content_changelog_reads: own" on public.content_changelog_reads
  for all using (user_id = auth.uid ()) with check (user_id = auth.uid ());

comment on table public.content_changelog is
  'Human-authored notices that a rule changed, targeted by template_id and '
  'shown only to users whose plan contains that task. Never generated from the '
  'source-watch checksum: a hash can say "look at this page", not "the law '
  'changed". Service-role writes only.';

commit;
