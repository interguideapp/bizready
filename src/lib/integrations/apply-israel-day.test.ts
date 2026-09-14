import { describe, expect, it } from "vitest";
import { applyBatch, type ApplyInput } from "@/lib/integrations/apply";
import { EMPTY_BATCH } from "@/lib/integrations/types";

/**
 * THE REVENUE WRITE PATH STAMPED THE UTC DAY.
 *
 * applyBatch had a local isoDay of d.toISOString().slice(0, 10), and `today`
 * is a real instant. Israel is UTC+2/+3, so from Israeli midnight until
 * 02:00/03:00 the UTC date is still yesterday. That value became:
 *
 *   metric_date for any synced document, lead or order carrying no date of its
 *   own — so revenue landed on the previous day, and across a month boundary in
 *   the previous MONTH. That figure feeds the twelve-month chart and the
 *   עוסק פטור ceiling, whose READ side was corrected earlier the same day. The
 *   write side was still doing it.
 *
 *   the year the ceiling is summed over, and its dedupe key — so the first
 *   sync after Israeli new year would sum against the old year and reuse the
 *   old year's key.
 *
 * The A10 pattern the product removed everywhere else, surviving in a local
 * helper that was a second answer to "what day is it".
 */
const input = (today: Date, extra: Partial<ApplyInput> = {}): ApplyInput => ({
  connection: { id: "c1", provider: "icount", label: "iCount", category: "invoicing" },
  batch: { ...EMPTY_BATCH, documents: [{ external_id: "d1", kind: "invoice", amount: 1000 }] },
  business: { entity_type: "osek_patur" },
  tasks: [],
  ytdRevenueBefore: 0,
  today,
  ...extra,
});

/** Jerusalem's calendar day for an instant, from Intl rather than the module. */
const jerusalemDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

describe("an undated document is stamped with the Israeli day", () => {
  it("uses tomorrow's date once Israel has turned the page", () => {
    // 22:30Z on the 14th is 01:30 on the 15th in Israel.
    const out = applyBatch(input(new Date("2026-09-14T22:30:00Z")));
    const revenue = out.metricDeltas.filter((m) => m.metric === "revenue");
    expect(revenue).toHaveLength(1);
    expect(revenue[0].metric_date).toBe("2026-09-15");
  });

  it("crosses the MONTH boundary with Israel, not with UTC", () => {
    // The case that misfiles revenue into the wrong month, which is what the
    // ceiling calculation and the twelve-month chart read.
    const out = applyBatch(input(new Date("2026-09-30T22:30:00Z")));
    const revenue = out.metricDeltas.filter((m) => m.metric === "revenue");
    expect(revenue[0].metric_date.slice(0, 7)).toBe("2026-10");
  });

  it("agrees with Jerusalem at every hour across a month boundary", () => {
    /*
     * A single instant only separates Jerusalem from SOME host zones — this
     * machine's resolves to Asia/Bangkok, where the two often agree — and TZ
     * is not honoured here, so it cannot be forced. Sweeping the boundary
     * catches a UTC or host-clock reading on any runner, and the premise below
     * makes the test admit when it proves nothing.
     */
    const start = Date.parse("2026-09-30T00:00:00Z");
    let separatedFromUtc = 0;
    for (let h = 0; h < 48; h++) {
      const at = new Date(start + h * 3_600_000);
      const out = applyBatch(input(at));
      const revenue = out.metricDeltas.filter((m) => m.metric === "revenue");
      expect(revenue[0].metric_date, at.toISOString()).toBe(jerusalemDay(at));
      if (at.toISOString().slice(0, 10) !== jerusalemDay(at)) separatedFromUtc++;
    }
    expect(
      separatedFromUtc,
      "no hour in this window separates UTC from Jerusalem, so this proves nothing"
    ).toBeGreaterThan(0);
  });

  it("leaves a document that carries its own date alone", () => {
    // The fallback is what was wrong; a provider-supplied date is authoritative.
    const out = applyBatch(
      input(new Date("2026-09-14T22:30:00Z"), {
        batch: {
          ...EMPTY_BATCH,
          documents: [
            { external_id: "d1", kind: "invoice", amount: 1000, issued_at: "2026-08-03" },
          ],
        },
      })
    );
    const revenue = out.metricDeltas.filter((m) => m.metric === "revenue");
    expect(revenue[0].metric_date).toBe("2026-08-03");
  });
});

describe("the ceiling year is Israel's year", () => {
  it("sums and keys against the new year once Israel is in it", () => {
    // 22:30Z on 31 December is 00:30 on 1 January in Israel. Summing against
    // the old year would carry a full year of revenue into the new one, and
    // the dedupe key would reuse the old year's — so the first warning of the
    // new year could be suppressed as already sent.
    const nearNewYear = new Date("2026-12-31T22:30:00Z");
    expect(jerusalemDay(nearNewYear).slice(0, 4)).toBe("2027");
    const out = applyBatch(
      input(nearNewYear, {
        ytdRevenueBefore: 0,
        batch: {
          ...EMPTY_BATCH,
          documents: [{ external_id: "d1", kind: "invoice", amount: 200_000 }],
        },
      })
    );
    const ceiling = out.notifications.filter((n) => n.dedupe_key.startsWith("ceiling:"));
    expect(ceiling.length).toBeGreaterThan(0);
    for (const n of ceiling) {
      expect(n.dedupe_key, n.dedupe_key).toContain("ceiling:2027:");
    }
  });
});
