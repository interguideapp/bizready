import { notFound } from "next/navigation";
import { loadLiveTasks, profileOf } from "@/lib/tasks-live";
import { nextCycleFor } from "@/lib/cycles";
import { ledgerPeriodFor } from "@/lib/filings";
import { filingRuleFor } from "@/lib/content/filing-rules";
import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { resolveArchetype } from "@/lib/content/archetypes";
import { interpolateFigures } from "@/lib/content/figures";
import { legalBasisOf } from "@/lib/content/legal-basis";
import { positionOf } from "@/lib/content/milestones";
import { resolveTemplate } from "@/lib/rules-engine";
import { computeUpcomingObligations, isStatutoryFiling } from "@/lib/compliance";
import { GENERATOR_BY_TEMPLATE, gateDocument } from "@/lib/documents/generators";
import { isPro } from "@/lib/subscription";
import { capabilitiesFor } from "@/lib/members";
import {
  requireBusinessContext,
  getChecklistItems,
  getDocuments,
  getFiledPeriods,
  getFilings,
  getOffersForTemplate,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todayInIsrael } from "@/lib/dates";
import { reviewAge } from "@/lib/staleness";
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

  const { business, role } = await requireBusinessContext();
  const caps = capabilitiesFor(role);
  const tasks = await loadLiveTasks(business);
  const task = tasks.find((t) => t.template_id === templateId);
  if (!task) notFound();

  const [allDocs, offers, checklist, filedPeriods, allFilings] = await Promise.all([
    getDocuments(business.id),
    getOffersForTemplate(template.id),
    getChecklistItems(task.id),
    getFiledPeriods(business.id),
    getFilings(business.id),
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
      .createSignedUrls(taskDocs.map((d) => d.storage_path), 300);
    data?.forEach((entry, i) => {
      if (entry.signedUrl) signedUrls.set(taskDocs[i].id, entry.signedUrl);
    });
  }

  const resolved = resolveTemplate(template, business.onboarding_answers);
  const steps = resolved.steps
    .split("\n")
    .map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/\*\*/g, ""))
    .filter(Boolean);
  // The typed column, not the old jsonb key. Deliberately NO fallback to
  // completion_data.__steps_done: 025 backfilled it, and a fallback would
  // resurrect old ticks for anyone who has since unticked every step, because
  // "the user cleared them" and "never migrated" both look like an empty array.
  const stepsDone = Array.isArray(task.steps_done)
    ? task.steps_done.filter((n) => Number.isInteger(n) && n >= 0 && n < steps.length)
    : [];

  // Where this task is in its own process. Derived on the server so the client
  // never has to reason about the chain — it renders a position and sends back
  // the stage id it acted from.
  const position = positionOf({
    template_id: template.id,
    stage: task.stage,
    status: task.status,
  });

  const statutory = isStatutoryFiling(template.id);
  // The deadline and the ledger are passed in deliberately. Without them the
  // engine could only ever answer "when is the next one", so this page showed
  // the next period's comfortable date while task.due_date — projected from the
  // same ledger by loadLiveTasks — pointed at a period already overdue. Two
  // dates for one filing, on one screen. Sorted by date, so [0] is the oldest
  // thing actually owed.
  const obligation = statutory
    ? computeUpcomingObligations(
        [
          {
            template_id: template.id,
            status: task.status,
            is_relevant: task.is_relevant,
            dismissal: task.dismissal,
            completion_data: task.completion_data,
            due_date: task.due_date,
            filed_periods: filedPeriods.get(template.id),
          },
        ],
        TEMPLATES_BY_ID,
        [],
        new Date(),
        profileOf(business)
      )[0] ?? null
    : null;

  // What comes after this one. The whole reason a filed task can now say
  // anything other than "done".
  const nextCycle = nextCycleFor({
    task: {
      template_id: template.id,
      status: task.status,
      due_date: task.due_date,
      completed_at: task.completed_at,
      completion_data: task.completion_data,
      filed_periods: filedPeriods.get(template.id),
    },
    template,
    today: new Date(),
    profile: profileOf(business),
  });

  // What this task has actually filed. The ledger (030) has recorded it all
  // along and nothing displayed it, so the only evidence a user had that they
  // filed was their own memory.
  const rule = filingRuleFor(template.id);
  const filings = allFilings
    .filter((f) => f.template_id === template.id)
    .map((f) => {
      // The stored key is authoritative; the label is presentation, so it is
      // recomputed from the rule rather than stored and allowed to go stale.
      const named = rule && f.due_date
        ? ledgerPeriodFor({
            anchor: rule.rule.anchor,
            dueIso: f.due_date,
            frequency: profileOf(business).vatFrequency ?? "bimonthly",
            coversDueYear: rule.kind === "registrar_fee",
          })
        : null;
      const evidence = f.evidence ?? {};
      return {
        periodKey: f.period_key,
        periodLabel: named?.key === f.period_key ? named.label : null,
        dueIso: f.due_date,
        filedAt: f.filed_at,
        amount: typeof evidence.amount === "string" && evidence.amount.trim() ? evidence.amount : null,
        reference:
          typeof evidence.reference === "string" && evidence.reference.trim()
            ? evidence.reference
            : null,
      };
    });

  const pro = isPro(business);
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

  // tasks this one unlocks (relevant tasks that depend on it) — the completion reward
  const relevantIds = new Set(tasks.filter((t) => t.is_relevant).map((t) => t.template_id));
  const unlocks = [...relevantIds]
    .map((id) => TEMPLATES_BY_ID.get(id))
    .filter((tpl) => tpl && tpl.id !== template.id && tpl.depends_on.includes(template.id))
    .map((tpl) => tpl!.title);

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
    stepsDone,
    guide: template.guide ? interpolateFigures(template.guide) : template.guide,
    pitfalls: (template.pitfalls ?? []).map(interpolateFigures),
    afterSubmit: template.after_submit ? interpolateFigures(template.after_submit) : null,
    basis: statutory ? "statutory" : "recommended",
    legalBasis: legalBasisOf(template.id),
    // Israel time, not UTC: a review that aged out overnight should read the
    // same to the user as it does to the review queue.
    reviewAge: reviewAge(template.last_reviewed, todayInIsrael()),
    sourceUrl: template.source_url ?? null,
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
    cycle: {
      // task.cycle is set by loadLiveTasks when the projection reopened this
      // row. Only then is there a reopening to explain.
      reopened: task.cycle
        ? {
            reason: task.cycle.reason,
            dueIso: task.cycle.dueIso,
            periodLabel: task.cycle.periodLabel,
            open: task.cycle.dueIso <= todayInIsrael(),
          }
        : null,
      next: nextCycle
        ? {
            reason: nextCycle.reason,
            dueIso: nextCycle.dueIso,
            periodLabel: nextCycle.periodLabel,
            open: nextCycle.open,
          }
        : null,
    },
    filings,
    milestones: {
      chain: position.chain,
      currentId: position.stage.id,
      step: position.step,
      total: position.total,
      nextLabel: position.next?.owner === "done" ? null : (position.next?.label ?? null),
      nextCompletes: position.advanceCompletes,
      resolvedFromStage: position.resolvedFromStage,
    },
    completion: template.completion ?? DEFAULT_COMPLETION,
    completionData: task.completion_data ?? {},
    completedAt: task.completed_at,
    waitingFor: task.waiting_for ?? null,
    todayIso: todayInIsrael(),
    personalDueDate: task.personal_due_date ?? null,
    // The obligation the compliance engine computed, when there is one. Taken
    // from there rather than recomputed so the picker cannot disagree with the
    // rest of the product about when a filing is due.
    statutoryDueDate: statutory && obligation ? obligation.dueDate : null,
    followUpDate: task.follow_up_date ?? null,
    docsNeeded: template.docs_needed,
    estCost: template.est_cost ? interpolateFigures(template.est_cost) : undefined,
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
    pro,
    canEdit: caps.completeTasks,
    readOnlyReason: caps.completeTasks
      ? null
      : "יש לכם גישת צפייה לתיק הזה. אפשר לראות הכול — לסמן משימות כבוצעו יכול רק בעל העסק או רו״ח עם הרשאת עריכה.",
    businessName: business.name,
    dealerNumber: business.dealer_number,
    unlocks,
    generator:
      showGenerator && gen
        ? { id: gen.id, title: gen.title, description: gen.description, category: gen.category }
        : null,
    // Truncated HERE, on the server. The client used to receive every section
    // and slice it for display, which is not a paywall — it is the full
    // document in the page source with a CSS crop over it.
    generatedDoc: showGenerator && gen ? gateDocument(gen.build(genRelevantCtx), pro) : null,
    ceiling: template.id === "patur-ceiling-watch" ? YEARLY_FIGURES.osekPaturCeiling : null,
  };

  const attachedDocs = taskDocs
    .filter((d) => d.task_id === task.id)
    .map((d) => ({ id: d.id, name: d.name, url: signedUrls.get(d.id) }));

  return (
    <TaskExperience view={view} attachedDocs={attachedDocs} docCategory={docCategory} />
  );
}
