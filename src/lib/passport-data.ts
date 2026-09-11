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
import { maskAccount } from "@/lib/privacy";
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
import { ENTITY_LABELS, type OnboardingAnswers } from "@/lib/types";
import type { PassportData } from "@/lib/documents/passport";
import { formatIlsRounded } from "@/lib/money";

// One formatter for the whole app — see lib/money.ts. Rounded here because
// these are aggregates and chart labels, where agorot are noise.
const nis = formatIlsRounded;
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

const FIELD_LABELS: Record<string, string> = {
  beauty_care: "טיפולים ויופי",
  food: "מזון",
  consulting: "ייעוץ, הדרכה ולימוד",
  tech: "טכנולוגיה ודיגיטל",
  commerce: "מסחר ומכירות",
  professional: "שירותים מקצועיים",
  creative: "אומנות ויצירה",
  construction: "בנייה ושיפוצים",
  other: "כללי",
};

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
    tasks.map((t) => ({
        template_id: t.template_id,
        status: t.status,
        is_relevant: t.is_relevant,
        dismissal: t.dismissal,
        completion_data: t.completion_data,
        due_date: t.due_date,
      })),
    TEMPLATES_BY_ID,
    documents.map((d) => ({ name: d.name, expires_at: d.expires_at })),
    new Date(),
    { entityType: business.entity_type, vatFrequency: answers?.vat_frequency, hasAccountant: Boolean(business.accountant_name) }
  );

  const identity: { label: string; value: string; ltr?: boolean }[] = [];
  // ltr is declared per field rather than applied to all of them. Forcing
  // dir="ltr" on every value mis-orders Hebrew content — a bank name, an
  // accountant's name — which is exactly what the passport view was doing.
  const push = (label: string, v: string | null | undefined, ltr?: boolean) => {
    if (v && v.trim()) identity.push({ label, value: v, ltr });
  };
  push("מספר עוסק", business.dealer_number, true);
  push("תיק מע\"מ", business.vat_file, true);
  push("תיק מס הכנסה", business.income_tax_file, true);
  push("תיק ביטוח לאומי", business.bituach_leumi_file, true);
  push("בנק", business.bank_name);
  push("סניף", business.bank_branch, true);
  // Masked on purpose: this document exists to be shared. The full number is
  // on the business card, which is the user's own private reference, and in
  // their data export.
  push("מספר חשבון", maskAccount(business.bank_account), true);
  push("רו\"ח / יועץ מס", business.accountant_name);
  push("טלפון רו\"ח", business.accountant_phone, true);
  push("אימייל רו\"ח", business.accountant_email, true);

  const hasCosts = costs.length > 0;
  const entityLabel = ENTITY_LABELS[business.entity_type as keyof typeof ENTITY_LABELS] ?? "עוסק";

  // Real registration facts (for the exported business profile) — plain
  // statements a bank/client/authority understands, not our readiness metrics.
  const regStatus: string[] = [`מסווג כ${entityLabel}`];
  if (business.dealer_number) regStatus.push(`מספר עוסק / ח.פ.: ${business.dealer_number}`);
  if (business.vat_file || business.entity_type === "osek_murshe" || business.entity_type === "company")
    regStatus.push(business.vat_file ? `רשום במע"מ · תיק ${business.vat_file}` : `רשום במע"מ`);
  if (business.income_tax_file) regStatus.push(`רשום במס הכנסה · תיק ${business.income_tax_file}`);
  if (business.bituach_leumi_file) regStatus.push(`רשום בביטוח לאומי · תיק ${business.bituach_leumi_file}`);
  if (business.accountant_name) regStatus.push(`מיוצג ע"י ${business.accountant_name}`);

  return {
    businessName: business.name,
    entityLabel,
    fieldLabel: business.field ? FIELD_LABELS[business.field] : undefined,
    regStatus,
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
