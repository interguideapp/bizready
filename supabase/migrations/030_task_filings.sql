-- ============================================================================
-- 030 — which reporting periods were actually filed.
--
-- Nothing recorded this. A recurring statutory filing kept its evidence in
-- business_tasks.completion_data, which is overwritten every period, so the
-- product could not answer "have I filed Jul–Aug?" — a core question for a
-- compliance tool and the thing an evidence pack most needs to contain.
--
-- The visible consequence: the obligations engine infers a missed period from
-- the deadline stored on the task row, and that column can only ever point at
-- ONE unfiled deadline (the sweep leaves it at the oldest). So a business two
-- periods behind was told about the first and never the second — the user least
-- able to catch up got the least help.
--
-- One row per (business, filing, period). The period key is built from the
-- period itself ("2026-07..2026-08"), not from its deadline, so it stays
-- correct if a filing deadline is ever changed by law.
--
-- APPEND-ONLY BY POLICY, like task_events. A filing record is a claim about
-- having met a statutory duty; being able to quietly delete one would make the
-- history worth exactly as much as the user's memory. Correcting a mistake is
-- an UPDATE to the same row (the unique key makes that the only option), which
-- leaves the row and its timestamps in place.
-- ============================================================================

begin;

create table if not exists public.task_filings (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Not a foreign key: task content lives in src/lib/content, and 016 removed
  -- the FKs to the unused task_templates mirror for exactly this reason.
  template_id text not null,
  /**
   * The period this filing covers: "2026-07..2026-08" for a bimonthly filer,
   * "2026-08..2026-08" for a monthly one. Owned by src/lib/filings.ts, which is
   * the single implementation of period identity.
   */
  period_key text not null,
  /** The statutory deadline for that period, kept so the row explains itself. */
  due_date date,
  /** When the user told us they filed it. */
  filed_at timestamptz not null default now(),
  /** Whatever the completion flow captured — confirmation numbers, amounts. */
  evidence jsonb,
  constraint task_filings_period_not_blank check (length(trim(period_key)) > 0),
  -- One record per period. A second submission for the same period is a
  -- correction of the first, not a new filing, and this is what makes that the
  -- only representable outcome.
  constraint task_filings_unique unique (business_id, template_id, period_key)
);

alter table public.task_filings enable row level security;

-- The question asked of this table is always "which periods did this business
-- file for this template", so the index matches it exactly.
create index if not exists task_filings_lookup_idx
  on public.task_filings (business_id, template_id, period_key);

-- ---------- access, mirroring business_tasks ----------
-- Owner reads and writes. An accountant may file, because filing is precisely
-- their job (022). A viewer reads only. Nobody deletes.
drop policy if exists "task_filings: owner all" on public.task_filings;
create policy "task_filings: owner all" on public.task_filings
  for select using (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "task_filings: owner insert" on public.task_filings;
create policy "task_filings: owner insert" on public.task_filings
  for insert with check (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "task_filings: owner update" on public.task_filings;
create policy "task_filings: owner update" on public.task_filings
  for update using (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_id = auth.uid ())
  );

drop policy if exists "task_filings: member read" on public.task_filings;
create policy "task_filings: member read" on public.task_filings
  for select using (public.is_business_member (business_id));

drop policy if exists "task_filings: accountant insert" on public.task_filings;
create policy "task_filings: accountant insert" on public.task_filings
  for insert with check (public.can_edit_business (business_id));

drop policy if exists "task_filings: accountant update" on public.task_filings;
create policy "task_filings: accountant update" on public.task_filings
  for update using (public.can_edit_business (business_id))
  with check (public.can_edit_business (business_id));

comment on table public.task_filings is
  'One row per (business, filing, reporting period). Exists because '
  'completion_data is overwritten each period, so the product could not say '
  'which periods had been filed — and could therefore only ever report ONE '
  'missed period. No DELETE policy: a claim about having met a statutory duty '
  'must not be quietly removable. A correction is an UPDATE to the same row.';

commit;
