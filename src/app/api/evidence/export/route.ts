import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { ENTITY_LABELS } from "@/lib/types";
import { verifyChain, type EvidenceEvent } from "@/lib/evidence";
import { isStatutoryFiling } from "@/lib/compliance";

export const dynamic = "force-dynamic";

/**
 * The evidence pack: a machine-readable, timestamped record of what was done,
 * when, by whom, and with what evidence — plus the integrity report for the
 * append-only trail it came from.
 *
 * This is the artefact a business can hand to an accountant. It is deliberately
 * NOT a score: the passport PDF covers the business profile, and the readiness
 * percentage is our metric, not proof of anything.
 */
export async function GET(request: Request) {
  const business = await getBusiness();
  if (!business) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();

  // select * so this keeps working whether or not 014 (actor/hash columns) has
  // been applied yet
  const { data: rawEvents, error: eventsError } = await supabase
    .from("task_events")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (eventsError) {
    return NextResponse.json(
      { error: "לא הצלחנו לטעון את יומן הפעילות" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const events = (rawEvents ?? []) as EvidenceEvent[];
  const chain = verifyChain(events);

  const { data: tasks } = await supabase
    .from("business_tasks")
    .select("template_id, status, due_date, completed_at, completion_data, is_relevant")
    .eq("business_id", business.id);

  const { data: documents } = await supabase
    .from("documents")
    .select("name, category, created_at, expires_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  const relevant = (tasks ?? []).filter((t) => t.is_relevant);

  const pack = {
    kind: "bizready.evidence-pack",
    version: 1,
    generated_at: new Date().toISOString(),
    disclaimer:
      "מסמך זה הופק אוטומטית מהנתונים שהוזנו על ידי בעל/ת העסק. הוא מתעד פעולות שבוצעו במערכת ואינו אישור רשמי מטעם רשות כלשהי.",

    business: {
      name: business.name,
      entity: ENTITY_LABELS[business.entity_type as keyof typeof ENTITY_LABELS] ?? null,
      dealer_number: business.dealer_number,
      vat_file: business.vat_file,
      income_tax_file: business.income_tax_file,
      bituach_leumi_file: business.bituach_leumi_file,
      started_at: business.started_at,
    },

    integrity: {
      ...chain,
      note: chain.verifiable
        ? "כל רשומה חתומה ומקושרת לקודמתה. מחיקה, הוספה או שינוי סדר יישברו את השרשרת."
        : "רשומות היומן טרם חתומות (יש להחיל את מיגרציה 014). התיעוד עצמו שלם.",
    },

    // what was completed, with the evidence captured at the time
    completed: relevant
      .filter((t) => t.status === "done")
      .map((t) => ({
        template_id: t.template_id,
        title: TEMPLATES_BY_ID.get(t.template_id)?.title ?? t.template_id,
        statutory: isStatutoryFiling(t.template_id),
        completed_at: t.completed_at,
        due_date: t.due_date,
        evidence: Object.fromEntries(
          Object.entries((t.completion_data ?? {}) as Record<string, unknown>)
            .filter(([k, v]) => !k.startsWith("__") && typeof v === "string" && v.trim())
        ),
      })),

    outstanding: relevant
      .filter((t) => t.status !== "done")
      .map((t) => ({
        template_id: t.template_id,
        title: TEMPLATES_BY_ID.get(t.template_id)?.title ?? t.template_id,
        statutory: isStatutoryFiling(t.template_id),
        status: t.status,
        due_date: t.due_date,
      })),

    documents: (documents ?? []).map((d) => ({
      name: d.name,
      category: d.category,
      filed_at: d.created_at,
      expires_at: d.expires_at,
    })),

    // the append-only trail itself
    trail: events.map((e) => ({
      at: e.created_at,
      kind: e.kind,
      template_id: e.template_id,
      title: e.template_id ? TEMPLATES_BY_ID.get(e.template_id)?.title ?? null : null,
      from_status: e.from_status,
      to_status: e.to_status,
      detail: e.detail,
      actor_kind: e.actor_kind ?? null,
      hash: e.hash ?? null,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = business.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 40);

  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // PII: never cache, never index
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Disposition": `attachment; filename="evidence-${safeName}-${stamp}.json"`,
    },
  });
}
