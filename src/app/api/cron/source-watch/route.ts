import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { TASK_TEMPLATES } from "@/lib/content";
import { FIGURES, type FigureKey } from "@/lib/content/figures";
import { FILING_RULES } from "@/lib/content/filing-rules";
import { legalBasisOf } from "@/lib/content/legal-basis";
import { compareSource, type SourceFingerprint } from "@/lib/content/source-watch";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly source watch: has any page we based a legal claim on changed?
 *
 * This is the half of regulatory-change detection that the review queue cannot
 * do. The queue asks "what is old"; a rule can change the week after it was
 * reviewed and stay "fresh" for a year. This asks "what moved".
 *
 * It NEVER updates content. A changed checksum flags the source for a human,
 * because a hash cannot distinguish a redrafted regulation from a reorganised
 * web page — and auto-editing legal content from a diff signal is precisely the
 * confident-but-unverified behaviour this whole pass has been removing.
 */

/** Every URL a statutory claim or a dated figure rests on. */
function watchedUrls(): string[] {
  const urls = new Set<string>();

  // The sources behind the dated filing rules — the claims with deadlines.
  for (const rule of Object.values(FILING_RULES)) urls.add(rule.source);

  // The sources behind the yearly figures — the claims with amounts.
  for (const key of Object.keys(FIGURES) as FigureKey[]) urls.add(FIGURES[key].source);

  // And the primary citation of every task the product presents as law.
  for (const template of TASK_TEMPLATES) {
    if (legalBasisOf(template.id) !== "statute") continue;
    const primary = template.source_url ?? template.official_links[0]?.url;
    if (primary) urls.add(primary);
  }

  return [...urls];
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const urls = watchedUrls();

  const { data: existing } = await supabase
    .from("source_fingerprints")
    .select("url, checksum, length, checked_at");

  const known = new Map<string, SourceFingerprint>(
    (existing ?? []).map((row) => [
      row.url as string,
      {
        url: row.url as string,
        checksum: row.checksum as string,
        length: row.length as number,
        checkedAt: row.checked_at as string,
      },
    ])
  );

  const changed: string[] = [];
  const unavailable: string[] = [];
  let unchanged = 0;
  let baselines = 0;

  for (const url of urls) {
    let html: string;
    try {
      const response = await fetch(url, {
        // A real UA: several gov.il endpoints reject an empty one, and a
        // rejection that looked like a change would be a false alarm every week.
        headers: { "user-agent": "BizReady-SourceWatch/1.0 (+compliance content review)" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!response.ok) {
        unavailable.push(`${url} (HTTP ${response.status})`);
        continue;
      }
      html = await response.text();
    } catch (err) {
      unavailable.push(`${url} (${err instanceof Error ? err.message : "fetch failed"})`);
      continue;
    }

    const verdict = compareSource(html, known.get(url) ?? null);

    if (verdict.status === "unavailable") {
      unavailable.push(`${url} (${verdict.reason})`);
      continue;
    }

    const row: Record<string, unknown> = {
      url,
      checksum: verdict.checksum,
      // Recomputed rather than trusted from the verdict, which only carries it
      // for the changed case.
      length: html.length,
      checked_at: new Date().toISOString(),
    };

    if (verdict.status === "changed") {
      changed.push(url);
      row.changed_at = new Date().toISOString();
      // A new change needs a new acknowledgement.
      row.acknowledged_at = null;
    } else if (verdict.status === "baseline") {
      baselines += 1;
    } else {
      unchanged += 1;
    }

    const { error } = await supabase.from("source_fingerprints").upsert(row, {
      onConflict: "url",
    });
    if (error) unavailable.push(`${url} (store failed: ${error.message})`);
  }

  return NextResponse.json({
    // Reported honestly: a run where half the fetches failed is not a clean run.
    ok: unavailable.length === 0,
    watched: urls.length,
    baselines,
    unchanged,
    changed,
    unavailable,
    note:
      "A changed source means a human must read it. Content is never updated " +
      "from this signal.",
  });
}
