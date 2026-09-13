/**
 * Read every row of a collection a scheduled sweep must fan out over.
 *
 * The reminders sweep selected `businesses` with no limit, no ordering and no
 * truncation check, and the sync sweep did the same over
 * `integration_connections`. Those are the outer loops of the two jobs whose
 * silence costs a user money, and PostgREST caps a response at its configured
 * max-rows — a number that lives in a dashboard setting this code never states
 * and cannot see. Past that cap the sweep would process a subset, report it as
 * the whole set, and, with no ORDER BY, not even the same subset each night.
 *
 * Nothing is broken today: there are two onboarded businesses. This removes
 * the dependency on a setting rather than waiting to find out what it is,
 * which is the same reason vercel-config.test.ts encodes the Hobby cron limit
 * instead of trusting that someone remembers it.
 *
 * The caller supplies the page fetch, so this stays pure and testable while the
 * query, its columns and its filters stay where they belong.
 */

/** Comfortably under any plausible PostgREST cap, few enough round trips. */
export const SWEEP_PAGE_SIZE = 500;

/**
 * A page fetch, shaped like a Supabase `.range()` call.
 *
 * `to` is INCLUSIVE, matching range() rather than slice(), because the callers
 * pass it straight through and an off-by-one here would silently drop one row
 * per page.
 */
/*
 * PromiseLike, not Promise: a Supabase query builder is thenable but is not a
 * Promise, so requiring one rejected the very callers this exists for.
 */
export type PageFetch<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export interface PagedResult<T> {
  rows: T[];
  /** Null on success. Rows read before a mid-pagination failure are kept. */
  error: string | null;
  /** How many requests it took, so a summary can show the fan-out was real. */
  pages: number;
}

/** Runaway guard: a backend that ignores `range` must not loop forever. */
const MAX_PAGES = 200;

export async function fetchAllPages<T>(
  fetchPage: PageFetch<T>,
  pageSize: number = SWEEP_PAGE_SIZE
): Promise<PagedResult<T>> {
  const rows: T[] = [];
  let pages = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    pages++;
    if (error) return { rows, error: error.message, pages };
    const batch = data ?? [];
    rows.push(...batch);
    // A short page is the end. Equal to pageSize might be the end too, but the
    // next request settles it — one extra round trip beats dropping rows.
    if (batch.length < pageSize) return { rows, error: null, pages };
    if (pages >= MAX_PAGES) {
      return { rows, error: "pagination did not terminate", pages };
    }
  }
}
