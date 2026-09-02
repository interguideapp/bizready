import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { resolveArchetype } from "@/lib/content/archetypes";
import { GENERATOR_BY_TEMPLATE } from "@/lib/documents/generators";
import { TaskExperience } from "@/components/task/task-experience";
import { DEFAULT_COMPLETION, YEARLY_FIGURES } from "@/lib/types";
import type { TaskView } from "@/lib/task-view";

/** Dev-only visual preview of the task experience per archetype (no auth/DB). */
const SAMPLES: Record<string, string> = {
  registration: "open-vat-file",
  filing: "vat-reporting",
  decision: "business-license",
  provider: "professional-liability-insurance",
  document: "privacy-policy",
  presence: "buy-domain",
  calculator: "patur-ceiling-watch",
  routine: "bookkeeping",
};

const MOCK_BUSINESS = {
  name: "הסטודיו של דנה",
  entityType: "osek_murshe",
  dealerNumber: "512345678",
  field: "beauty_care",
};

function buildMockView(templateId: string): TaskView {
  const t = TEMPLATES_BY_ID.get(templateId)!;
  const cat = CATEGORIES_BY_ID.get(t.category_id)!;
  const archetype = resolveArchetype(t.id);
  const gen = GENERATOR_BY_TEMPLATE.get(t.id) ?? null;
  const steps = t.steps
    .split("\n")
    .map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/\*\*/g, ""))
    .filter(Boolean);

  return {
    taskDbId: "mock-task",
    templateId: t.id,
    archetype,
    title: t.title,
    categoryTitle: cat.title,
    categoryIcon: cat.icon,
    priority: t.priority,
    status: "todo",
    why: t.why,
    steps,
    guide: t.guide,
    basis: archetype === "filing" ? "statutory" : "recommended",
    dueDate: "2026-10-01",
    obligation:
      archetype === "filing"
        ? {
            dueDate: "2026-09-15",
            periodLabel: "יולי–אוגוסט 2026",
            ruleText:
              'דיווח מע"מ מוגש אחת לחודשיים, עד ה-15 בחודש שאחרי סוף התקופה. התקופה יולי–אוגוסט 2026 מוגשת עד 15.09.2026.',
            sourceUrl: "https://www.gov.il/he/departments/israel_tax_authority",
          }
        : null,
    recurrence: t.recurrence ?? null,
    completion: t.completion ?? DEFAULT_COMPLETION,
    completionData: {},
    completedAt: null,
    waitingFor: null,
    followUpDate: null,
    docsNeeded: t.docs_needed,
    estCost: t.est_cost,
    estTime: t.est_time,
    officialLinks: t.official_links,
    primaryLink: t.official_links[0] ?? null,
    offers:
      archetype === "provider"
        ? [
            {
              id: "mock-offer",
              title: "סוכנות ביטוח שותפה",
              description: "השוואת הצעות אחריות מקצועית לתחומכם, בהנחה למשתמשי BizReady.",
              ctaLabel: "לקבלת הצעה",
              url: "https://example.com",
              couponCode: "BIZ10",
            },
          ]
        : [],
    checklist: [],
    notes: "",
    pro: false,
    businessName: MOCK_BUSINESS.name,
    dealerNumber: MOCK_BUSINESS.dealerNumber,
    generator: gen ? { id: gen.id, title: gen.title, description: gen.description, category: gen.category } : null,
    generatedDoc: gen
      ? gen.build({
          businessName: MOCK_BUSINESS.name,
          entityType: MOCK_BUSINESS.entityType,
          dealerNumber: MOCK_BUSINESS.dealerNumber,
          field: MOCK_BUSINESS.field,
          answers: { collects_personal_data: true },
        })
      : null,
    ceiling: t.id === "patur-ceiling-watch" ? YEARLY_FIGURES.osekPaturCeiling : null,
  };
}

export default async function TaskPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { a } = await searchParams;
  const archetype = a ?? "registration";
  const templateId = SAMPLES[archetype] ?? SAMPLES.registration;
  const view = buildMockView(templateId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Object.keys(SAMPLES).map((k) => (
          <Link
            key={k}
            href={`/dev/task-preview?a=${k}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              k === archetype ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-soft"
            }`}
          >
            {k}
          </Link>
        ))}
      </div>
      <TaskExperience view={view} attachedDocs={[]} docCategory="registration" />
    </div>
  );
}
