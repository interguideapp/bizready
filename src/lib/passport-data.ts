import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getCosts,
  getDocuments,
  getProducts,
} from "@/lib/data";
import { computeScore } from "@/lib/rules-engine";
import { computeUpcomingObligations } from "@/lib/compliance";
import { computeProfileCompleteness } from "@/lib/profile-score";
import {
  computeBadges,
  computeStreak,
  computeXp,
  levelFromXp,
} from "@/lib/gamification";
import { CATEGORIES } from "@/lib/content";
import { annualTotal, CADENCE_LABEL, monthlyTotal } from "@/lib/costs";
import { getTaskEvents } from "@/lib/data";
import type { OnboardingAnswers } from "@/lib/types";
import type { PassportData } from "@/lib/documents/passport";

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const heDate = (iso: string | null) =>
  iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("he-IL") : "—";
const DOC_LABEL: Record<string, string> = {
  registration: "רישום ואישורים",
  tax: "מיסים",
  insurance: "ביטוחים",
  agreements: "הסכמים ומשפט",
  other: "כללי",
};
const STAGE_OF = new Map(CATEGORIES.map((c) => [c.id, c.stage]));

/** Gathers the full business passport (server). Used by the page and the PDF route. */
export async function loadPassport(): Promise<PassportData | null> {
  const business = await getBusiness();
  if (!business) return null;

  const [tasks, documents, costs, products, events] = await Promise.all([
    getBusinessTasks(business.id),
    getDocuments(business.id),
    getCosts(business.id),
    getProducts(business.id),
    getTaskEvents(business.id, 200),
  ]);

  const answers = business.onboarding_answers as OnboardingAnswers;
  const score = computeScore(tasks, TEMPLATES_BY_ID);
  const scoreByCat = new Map(score.byCategory.map((c) => [c.category_id, c]));
  const relevant = tasks.filter((t) => t.is_relevant);
  const profile = computeProfileCompleteness(business, {
    products: products.length,
    documents: documents.length,
  });

  const gamiTasks = tasks.map((t) => ({
    template_id: t.template_id,
    status: t.status,
    is_relevant: t.is_relevant,
    completed_at: t.completed_at,
  }));
  const level = levelFromXp(computeXp(gamiTasks, TEMPLATES_BY_ID));
  const streak = computeStreak(events.map((e) => ({ kind: e.kind, created_at: e.created_at })));
  const badges = computeBadges({
    tasks: gamiTasks,
    templates: TEMPLATES_BY_ID,
    stageOf: (cid) => STAGE_OF.get(cid) ?? "operating",
    profilePercent: profile.percent,
    documentsCount: documents.length,
    streak,
  }).filter((b) => b.earned);

  const obligations = computeUpcomingObligations(
    tasks.map((t) => ({ template_id: t.template_id, status: t.status, is_relevant: t.is_relevant, completion_data: t.completion_data })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );

  const identity: { label: string; value: string }[] = [];
  const push = (label: string, v: string | null | undefined) => {
    if (v && v.trim()) identity.push({ label, value: v });
  };
  push("מספר עוסק", business.dealer_number);
  push("תיק מע\"מ", business.vat_file);
  push("תיק מס הכנסה", business.income_tax_file);
  push("תיק ביטוח לאומי", business.bituach_leumi_file);
  push("בנק", business.bank_name);
  push("סניף", business.bank_branch);
  push("מספר חשבון", business.bank_account);
  push("רו\"ח / יועץ מס", business.accountant_name);
  push("טלפון רו\"ח", business.accountant_phone);
  push("אימייל רו\"ח", business.accountant_email);

  const hasCosts = costs.length > 0;

  return {
    businessName: business.name,
    entityLabel: business.entity_type === "osek_murshe" ? "עוסק מורשה" : "עוסק פטור",
    generatedAt: new Date().toLocaleDateString("he-IL"),
    identity,
    levelTitle: level.title,
    levelNumber: level.level,
    score: score.overall,
    completedCount: relevant.filter((t) => t.status === "done").length,
    totalCount: relevant.length,
    badges: badges.map((b) => b.title),
    categories: CATEGORIES.filter((c) => scoreByCat.has(c.id)).map((c) => {
      const s = scoreByCat.get(c.id)!;
      return { title: c.title, score: s.score, done: s.done, total: s.total };
    }),
    obligations: obligations.slice(0, 12).map((o) => ({
      title: o.title,
      date: heDate(o.dueDate),
      period: o.periodLabel,
    })),
    documents: documents.map((d) => ({
      name: d.name,
      category: DOC_LABEL[d.category] ?? d.category,
      date: heDate(d.created_at),
      expires: d.expires_at ? heDate(d.expires_at) : null,
    })),
    costs: costs.map((c) => ({
      name: c.name,
      amount: nis(c.amount),
      cadence: CADENCE_LABEL[c.cadence] ?? c.cadence,
    })),
    monthlyCost: hasCosts ? nis(monthlyTotal(costs)) : null,
    annualCost: hasCosts ? nis(annualTotal(costs)) : null,
    products: products.map((p) => ({
      name: p.name,
      price: p.price != null ? nis(p.price) : "—",
      unit: p.unit,
    })),
  };
}
