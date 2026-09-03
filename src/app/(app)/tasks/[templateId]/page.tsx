import { notFound } from "next/navigation";
import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { resolveArchetype } from "@/lib/content/archetypes";
import { resolveTemplate } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { GENERATOR_BY_TEMPLATE } from "@/lib/documents/generators";
import { isPro } from "@/lib/subscription";
import {
  getBusiness,
  getBusinessTasks,
  getChecklistItems,
  getDocuments,
  getOffersForTemplate,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMPLETION, YEARLY_FIGURES } from "@/lib/types";
import type { OnboardingAnswers } from "@/lib/types";
import type { TaskView } from "@/lib/task-view";
import { TaskExperience } from "@/components/task/task-experience";

const DOC_CATEGORY_BY_TASK_CATEGORY: Record<string, string> = {
  "legal-setup": "registration",
  tax: "tax",
  finance: "tax",
  "insurance-legal": "insurance",
  "digital-regulation": "agreements",
  "digital-presence": "other",
  marketing: "other",
  operations: "other",
  employment: "registration",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = TEMPLATES_BY_ID.get(templateId);
  if (!template) notFound();

  const business = (await getBusiness())!;
  const tasks = await getBusinessTasks(business.id);
  const task = tasks.find((t) => t.template_id === templateId);
  if (!task) notFound();

  const [allDocs, offers, checklist] = await Promise.all([
    getDocuments(business.id),
    getOffersForTemplate(template.id),
    getChecklistItems(task.id),
  ]);
  const category = CATEGORIES_BY_ID.get(template.category_id)!;
  const answers = business.onboarding_answers as OnboardingAnswers;
  const archetype = resolveArchetype(template.id);
  const docCategory = DOC_CATEGORY_BY_TASK_CATEGORY[template.category_id] ?? "other";

  // step docs attached to this task
  const taskDocs = allDocs.filter((d) => d.task_id === task.id || d.checklist_item_id != null);
  const signedUrls = new Map<string, string>();
  if (taskDocs.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(taskDocs.map((d) => d.storage_path), 3600);
    data?.forEach((entry, i) => {
      if (entry.signedUrl) signedUrls.set(taskDocs[i].id, entry.signedUrl);
    });
  }

  const resolved = resolveTemplate(template, business.onboarding_answers);
  const steps = resolved.steps
    .split("\n")
    .map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/\*\*/g, ""))
    .filter(Boolean);

  const statutory = isStatutoryFiling(template.id);
  const obligation = statutory
    ? computeUpcomingObligations(
        [
          {
            template_id: template.id,
            status: task.status,
            is_relevant: task.is_relevant,
            completion_data: task.completion_data,
          },
        ],
        TEMPLATES_BY_ID,
        [],
        new Date(),
        {
          entityType: business.entity_type,
          vatFrequency: answers?.vat_frequency,
          hasAccountant: Boolean(business.accountant_name),
        }
      )[0] ?? null
    : null;

  const gen = GENERATOR_BY_TEMPLATE.get(template.id) ?? null;
  const genRelevantCtx = {
    businessName: business.name,
    entityType: business.entity_type,
    dealerNumber: business.dealer_number,
    field: business.field,
    answers,
    today: new Date(),
  };
  const showGenerator = gen && (!gen.isRelevant || gen.isRelevant(genRelevantCtx));

  const view: TaskView = {
    taskDbId: task.id,
    templateId: template.id,
    archetype,
    title: template.title,
    categoryTitle: category.title,
    categoryIcon: category.icon,
    priority: template.priority,
    status: task.status,
    why: resolved.why,
    steps,
    guide: template.guide,
    pitfalls: template.pitfalls ?? [],
    basis: statutory ? "statutory" : "recommended",
    dueDate: task.due_date,
    obligation: obligation
      ? {
          dueDate: obligation.dueDate,
          periodLabel: obligation.periodLabel,
          ruleText: obligation.ruleText,
          sourceUrl: obligation.sourceUrl,
        }
      : null,
    recurrence: template.recurrence ?? null,
    completion: template.completion ?? DEFAULT_COMPLETION,
    completionData: task.completion_data ?? {},
    completedAt: task.completed_at,
    waitingFor: task.waiting_for ?? null,
    followUpDate: task.follow_up_date ?? null,
    docsNeeded: template.docs_needed,
    estCost: template.est_cost,
    estTime: template.est_time,
    officialLinks: template.official_links,
    primaryLink: template.official_links[0] ?? null,
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      ctaLabel: o.cta_label,
      url: o.url,
      couponCode: o.coupon_code,
    })),
    checklist: checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })),
    notes: task.notes ?? "",
    pro: isPro(business),
    businessName: business.name,
    dealerNumber: business.dealer_number,
    generator:
      showGenerator && gen
        ? { id: gen.id, title: gen.title, description: gen.description, category: gen.category }
        : null,
    generatedDoc: showGenerator && gen ? gen.build(genRelevantCtx) : null,
    ceiling: template.id === "patur-ceiling-watch" ? YEARLY_FIGURES.osekPaturCeiling : null,
  };

  const attachedDocs = taskDocs
    .filter((d) => d.task_id === task.id)
    .map((d) => ({ id: d.id, name: d.name, url: signedUrls.get(d.id) }));

  return (
    <TaskExperience view={view} attachedDocs={attachedDocs} docCategory={docCategory} />
  );
}
