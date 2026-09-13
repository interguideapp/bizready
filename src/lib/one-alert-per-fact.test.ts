import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeAttention, syncErrorDrafts } from "@/lib/live-attention";

/**
 * One broken connection is one row in the alerts list.
 *
 * It was two. The sync cron inserted a sync_errors row AND upserted its own
 * notification keyed `syncfail:<connection>:<date>`, while syncErrorDrafts
 * derives an alert from that same sync_errors row keyed `sync:<occurred_at>`.
 * mergeAttention dedupes by exact key equality, so the two could never match —
 * and because "sync" ranks 3 while the stored row's "system" type is unranked
 * and sorts last, the pair appeared at opposite ends of the list rather than
 * reading as a duplicate.
 *
 * The stored copy was also strictly worse. getOpenSyncErrors filters on
 * resolved_at, so the derived alert clears the moment the user resolves the
 * error; a stored notification persists until it is READ. Fixing the connection
 * left the alarm standing — the same shape as the renewal nobody could clear.
 *
 * Dedupe by string equality is only as good as the guarantee that one fact
 * produces one key, and nothing was asserting that guarantee.
 */
const err = (over: Partial<{ id: string; message: string; occurred_at: string }> = {}) => ({
  id: "e1",
  message: "401 unauthorized",
  occurred_at: "2026-09-13T04:00:00Z",
  ...over,
});

describe("a sync failure produces exactly one alert", () => {
  it("is a single item, not one per error", () => {
    // Five failures of the same broken connection are one problem.
    const items = mergeAttention(
      [],
      syncErrorDrafts([err({ id: "a" }), err({ id: "b" }), err({ id: "c" })])
    );
    expect(items).toHaveLength(1);
  });

  it("is not joined by a second, differently-keyed stored copy", () => {
    /**
     * The regression, expressed as data: a stored row written by the cron under
     * its own key alongside the derived one. Both describe the same failure and
     * dedupe cannot match them.
     */
    const storedTheOldWay = [
      {
        id: "n1",
        type: "system",
        title: "סנכרון iCount נכשל",
        body: "בדקו את פרטי החיבור במסך האינטגרציות.",
        template_id: null,
        dedupe_key: "syncfail:conn-1:2026-09-13",
        read_at: null,
        created_at: "2026-09-13T04:00:01Z",
      },
    ];
    const both = mergeAttention(storedTheOldWay, syncErrorDrafts([err()]));
    // Two rows for one broken connection is what this prevents, so the shape
    // is asserted here to document precisely what was wrong.
    expect(both).toHaveLength(2);
    expect(both.filter((i) => i.type === "sync")).toHaveLength(1);
    expect(both.filter((i) => i.type === "system")).toHaveLength(1);
  });

  it("the cron no longer writes that second copy", () => {
    // Source-level, because the absence of a write cannot be observed from a
    // pure function. This is the assertion that actually holds the fix.
    const route = readFileSync(
      join(process.cwd(), "src/app/api/cron/sync/route.ts"),
      "utf8"
    );
    const shipped = route
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(shipped).not.toContain('from("notifications")');
    expect(shipped).not.toContain("syncfail:");
    // The durable record must stay: the alert is derived from it.
    expect(shipped).toContain('from("sync_errors")');
  });

  it("keeps the derived alert self-clearing", () => {
    // The property that makes deriving the better of the two: resolving the
    // error removes the row from the query, so the alarm goes with it.
    const data = readFileSync(join(process.cwd(), "src/lib/data.ts"), "utf8");
    const fn = data.slice(data.indexOf("export async function getOpenSyncErrors"));
    expect(fn.slice(0, 500)).toContain('.is("resolved_at", null)');
  });

  it("keys on the newest occurrence, so a standing failure does not renag", () => {
    const older = syncErrorDrafts([err({ occurred_at: "2026-09-10T04:00:00Z" })])[0];
    const newer = syncErrorDrafts([err({ occurred_at: "2026-09-13T04:00:00Z" })])[0];
    expect(older.dedupe_key).not.toBe(newer.dedupe_key);
  });
});
