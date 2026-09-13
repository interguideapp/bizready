import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SWEEP_PAGE_SIZE, fetchAllPages, type PageFetch } from "@/lib/supabase/page-all";

/**
 * Reading every row of a sweep's outer collection.
 *
 * The reminders sweep selected `businesses` unbounded and unordered, and the
 * sync sweep did the same over `integration_connections`. PostgREST caps a
 * response at its configured max-rows, a value that lives in a dashboard
 * setting this code never states — so past it the sweep would process a subset
 * and report it as the whole set, and without ORDER BY not even the same subset
 * twice.
 */

/** A backend holding `total` rows that honours an inclusive range. */
function backend(total: number, cap = SWEEP_PAGE_SIZE): PageFetch<number> {
  const all = Array.from({ length: total }, (_, i) => i);
  return async (from, to) => ({
    // The cap is what PostgREST applies on top of the requested range: this is
    // the behaviour the old code was unknowingly relying on.
    data: all.slice(from, Math.min(to + 1, from + cap)),
    error: null,
  });
}

describe("it reads everything", () => {
  it("returns a single short page as-is", async () => {
    const res = await fetchAllPages(backend(2), 500);
    expect(res.rows).toHaveLength(2);
    expect(res.pages).toBe(1);
    expect(res.error).toBeNull();
  });

  it("reads past the page size, which the old query could not", async () => {
    const res = await fetchAllPages(backend(1250), 500);
    expect(res.rows).toHaveLength(1250);
    expect(res.rows[0]).toBe(0);
    expect(res.rows[1249]).toBe(1249);
  });

  it("spends one extra request when the total is an exact multiple", async () => {
    // A full final page cannot be distinguished from a full middle one, and
    // guessing would drop the tail.
    const res = await fetchAllPages(backend(1000), 500);
    expect(res.rows).toHaveLength(1000);
    expect(res.pages).toBe(3);
  });

  it("handles an empty collection without a second request", async () => {
    const res = await fetchAllPages(backend(0), 500);
    expect(res.rows).toEqual([]);
    expect(res.pages).toBe(1);
  });

  it("asks for an inclusive range, matching Supabase's range()", async () => {
    const spy = vi.fn<PageFetch<number>>(async () => ({ data: [], error: null }));
    await fetchAllPages(spy, 500);
    expect(spy).toHaveBeenCalledWith(0, 499);
  });

  it("loses no row across a page boundary", async () => {
    const res = await fetchAllPages(backend(1001), 500);
    expect(new Set(res.rows).size).toBe(1001);
  });
});

describe("it fails safely", () => {
  it("reports a mid-pagination error and keeps what it already read", async () => {
    // Half the businesses swept is not a success, and it is not nothing
    // either: the caller has to be able to tell.
    let call = 0;
    const res = await fetchAllPages<number>(async (from, to) => {
      call++;
      if (call === 2) return { data: null, error: { message: "connection reset" } };
      return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null };
    }, 500);
    expect(res.error).toBe("connection reset");
    expect(res.rows).toHaveLength(500);
  });

  it("stops rather than looping forever if range is ignored", async () => {
    // A backend that returns a full page whatever is asked would otherwise
    // spin until the function timed out, taking the whole sweep with it.
    const res = await fetchAllPages<number>(
      async () => ({ data: Array.from({ length: 500 }, (_, i) => i), error: null }),
      500
    );
    expect(res.error).toBe("pagination did not terminate");
    expect(res.pages).toBe(200);
  });

  it("treats a null data with no error as the end", async () => {
    const res = await fetchAllPages<number>(async () => ({ data: null, error: null }), 500);
    expect(res.rows).toEqual([]);
    expect(res.error).toBeNull();
  });
});

describe("the sweeps that fan out actually use it", () => {
  /**
   * Asserted at the source. The helper being correct is worth nothing if the
   * route goes back to one unbounded select, which typechecks and passes every
   * other test — and the failure mode is a subset of businesses swept in
   * silence, which is invisible from outside.
   */
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

  const FANOUTS: Array<[string, string]> = [
    ["src/app/api/cron/reminders/route.ts", '.from("businesses")'],
    ["src/app/api/cron/sync/route.ts", '.from("integration_connections")'],
  ];

  it("pages the outer collection instead of selecting it whole", () => {
    for (const [file] of FANOUTS) {
      expect(read(file), `${file} no longer pages`).toContain("fetchAllPages(");
    }
  });

  it("orders the pages, so they cannot overlap or skip rows", () => {
    // Offset pagination without an ORDER BY is not pagination: Postgres is free
    // to return rows in any order per request.
    for (const [file, from] of FANOUTS) {
      const src = read(file);
      const at = src.indexOf(from);
      expect(at, `${file} no longer queries ${from}`).toBeGreaterThan(-1);
      // A fixed window over the query block: my first attempt computed the end
      // from indexOf(")") after the .range call and cut the slice short of it.
      const query = src.slice(at, at + 700);
      expect(query, `${file} pages without ordering`).toContain('.order("id")');
      expect(query).toContain(".range(from, to)");
    }
  });

  it("treats a partial read as a failed run, not a quiet success", () => {
    // Half the businesses swept must leave the job due, or the heartbeat says
    // the reminders went out when most of them did not.
    const src = read("src/app/api/cron/reminders/route.ts");
    expect(src).toContain("endCronRun(supabase, run, false, {");
    expect(src).toContain("businessesRead: businesses.length");
  });
});
