import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Lightbulb,
  ListChecks,
  ListTodo,
  Paperclip,
} from "lucide-react";
import { AdvertiseCard } from "@/components/advertise-card";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { CategoryIcon } from "@/components/category-icon";
import { DocumentUpload } from "@/components/document-upload";
import { GuideContent } from "@/components/guide-content";
import { LogoUploader } from "@/components/logo-uploader";
import { OfferCard } from "@/components/offer-card";
import { PriceList } from "@/components/price-list";
import { StepsContent } from "@/components/steps-content";
import { NotesEditor, StatusPicker } from "@/components/task-controls";
import { Card, Disclaimer } from "@/components/ui";
import { DueDateControl } from "@/components/due-date-editor";
import { TaskChecklist } from "@/components/task-checklist";
import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import { resolveTemplate } from "@/lib/rules-engine";
import {
  computeUpcomingObligations,
  isStatutoryFiling,
} from "@/lib/compliance";
import type { OnboardingAnswers } from "@/lib/types";
import {
  getBusiness,
  getBusinessTasks,
  getChecklistItems,
  getDocuments,
  getOffersForTemplate,
  getProducts,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Task ids that get an in-app smart action embedded in their page. */
const SMART_ACTION_TASKS = new Set(["basic-branding", "pricing"]);

const DOC_CATEGORY_BY_TASK_CATEGORY: Record<string, string> = {
  "legal-setup": "registration",
  tax: "tax",
  finance: "tax",
  "insurance-legal": "insurance",
  "digital-regulation": "agreements",
  "digital-presence": "other",
  marketing: "other",
  operations: "other",
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
  const documents = allDocs.filter((d) => d.task_id === task.id);
  const stepDocs = allDocs.filter((d) => d.checklist_item_id != null);
  const category = CATEGORIES_BY_ID.get(template.category_id)!;

  // signed URLs for files attached to checklist steps
  const stepDocUrls = new Map<string, string>();
  if (stepDocs.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(stepDocs.map((d) => d.storage_path), 3600);
    data?.forEach((entry, i) => {
      if (entry.signedUrl) stepDocUrls.set(stepDocs[i].id, entry.signedUrl);
    });
  }
  // profile-specific steps/why (e.g. attendance app vs. physical clock)
  const resolved = resolveTemplate(template, business.onboarding_answers);

  // statutory filings carry a real, sourced deadline; everything else is a
  // recommendation. Compute the rule text so we can show "why this date".
  const statutory = isStatutoryFiling(template.id);
  const answers = business.onboarding_answers as OnboardingAnswers;
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

  // smart in-app actions for specific tasks
  let smartAction: React.ReactNode = null;
  if (SMART_ACTION_TASKS.has(template.id)) {
    if (template.id === "pricing") {
      const products = await getProducts(business.id);
      smartAction = (
        <Card className="p-5">
          <h3 className="mb-1 font-bold text-ink">המחירון שלי</h3>
          <p className="mb-4 text-sm text-ink-muted">
            בנו את המחירון ישירות כאן — הוא נשמר בפרופיל העסקי שלכם
          </p>
          <PriceList products={products} />
        </Card>
      );
    } else if (template.id === "basic-branding") {
      let logoUrl: string | null = null;
      if (business.logo_path) {
        const supabase = await createClient();
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(business.logo_path, 3600);
        logoUrl = data?.signedUrl ?? null;
      }
      smartAction = (
        <Card className="p-5">
          <h3 className="mb-1 font-bold text-ink">הלוגו שלי</h3>
          <p className="mb-4 text-sm text-ink-muted">
            יש כבר לוגו? העלו אותו — הוא יישמר בפרופיל העסקי ותמיד יהיה בהישג יד
          </p>
          <LogoUploader currentLogoUrl={logoUrl} />
        </Card>
      );
    }
  }

  const dependencies = template.depends_on
    .map((depId) => {
      const depTemplate = TEMPLATES_BY_ID.get(depId);
      const depTask = tasks.find((t) => t.template_id === depId);
      return depTemplate && depTask ? { depTemplate, depTask } : null;
    })
    .filter(Boolean) as {
    depTemplate: NonNullable<ReturnType<typeof TEMPLATES_BY_ID.get>>;
    depTask: (typeof tasks)[number];
  }[];
  const openDeps = dependencies.filter(
    (d) => d.depTask.status !== "done" && d.depTask.status !== "not_relevant"
  );

  return (
    <div>
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
        כל המשימות
      </Link>

      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <CategoryIcon name={category.icon} className="h-4 w-4" />
          {category.title}
        </div>
        <h1 className="text-2xl font-bold text-ink">{template.title}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={template.priority} />
          {task.status !== "done" && (
            <DueDateControl
              taskId={task.id}
              dueDate={
                statutory && obligation ? obligation.dueDate : task.due_date
              }
              basis={statutory ? "statutory" : "recommended"}
            />
          )}
          {template.recurrence && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
              {template.recurrence === "monthly"
                ? "משימה חודשית"
                : template.recurrence === "bimonthly"
                  ? "אחת לחודשיים"
                  : "משימה שנתית"}
            </span>
          )}
        </div>
      </header>

      {/* statutory deadline reasoning — the credibility of the date, shown openly */}
      {statutory && obligation && (
        <Card className="mb-4 border-brand-edge bg-brand-tint/40 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                מועד חוקי הבא:{" "}
                {new Date(obligation.dueDate + "T00:00:00").toLocaleDateString(
                  "he-IL"
                )}
                {obligation.periodLabel && (
                  <span className="font-normal text-ink-muted">
                    {" "}
                    · {obligation.periodLabel}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {obligation.ruleText}
              </p>
              {obligation.sourceUrl && (
                <a
                  href={obligation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                >
                  מקור רשמי — רשות המסים
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* recommended (non-statutory) framing — honest: a suggestion, not a law */}
      {!statutory && task.due_date && task.status !== "done" && (
        <p className="mb-4 text-xs leading-relaxed text-ink-faint">
          התאריך הזה הוא <b className="text-ink-muted">המלצה</b> שלנו (בערך{" "}
          {template.deadline_days} ימים מפתיחת העסק), לא מועד חוקי — קבעו לעצמכם
          יעד שנוח לכם, ותוכלו לשנות אותו בכל רגע.
        </p>
      )}

      {/* status */}
      <Card className="p-4">
        <StatusPicker
          taskId={task.id}
          status={task.status}
          steps={resolved.steps
            .split("\n")
            .map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/\*\*/g, ""))
            .filter(Boolean)}
          completion={template.completion}
          waitingFor={task.waiting_for ?? null}
          followUpDate={task.follow_up_date ?? null}
        />
      </Card>

      {openDeps.length > 0 && (
        <Card className="mt-4 border-status-progress-bg bg-status-progress-bg/60 p-4">
          <p className="text-sm font-semibold text-status-progress">
            כדאי קודם להשלים:
          </p>
          <ul className="mt-1.5 space-y-1">
            {openDeps.map(({ depTemplate }) => (
              <li key={depTemplate.id}>
                <Link
                  href={`/tasks/${depTemplate.id}`}
                  className="text-sm font-medium text-ink-soft underline decoration-edge-strong hover:text-ink"
                >
                  {depTemplate.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* recorded evidence */}
      {task.status === "done" &&
        Object.keys(task.completion_data ?? {}).length > 0 && (
          <Card className="mt-4 border-status-done/30 bg-status-done-bg/40 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-status-done">
              <Check className="h-4 w-4" aria-hidden />
              מה תועד בסיום
            </p>
            <dl className="grid gap-1.5 text-sm">
              {Object.entries(task.completion_data ?? {}).map(([k, v]) =>
                v ? (
                  <div key={k} className="flex gap-2">
                    <dt className="text-ink-muted">
                      {template.completion?.fields?.find((f) => f.key === k)
                        ?.label ?? k}
                      :
                    </dt>
                    <dd className="font-medium text-ink">{v}</dd>
                  </div>
                ) : null
              )}
            </dl>
            {task.completed_at && (
              <p className="mt-2 text-xs text-ink-muted">
                הושלם ב-
                {new Date(task.completed_at).toLocaleDateString("he-IL")}
              </p>
            )}
          </Card>
        )}

      {/* why */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 font-bold text-ink">
          <Lightbulb className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          למה זה חשוב
        </h2>
        <p className="leading-relaxed text-ink-soft">{resolved.why}</p>
      </section>

      {/* steps */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
          <ListTodo className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          איך עושים את זה
        </h2>
        <Card className="p-5">
          <StepsContent text={resolved.steps} />
        </Card>
      </section>

      {/* extended guide, when available */}
      {template.guide && (
        <section className="mt-6">
          <GuideContent text={template.guide} />
        </section>
      )}

      {/* personal checklist — "הדרך שלי" */}
      <section className="mt-6">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
          <ListChecks className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          הדרך שלי
        </h2>
        <p className="mb-3 text-sm text-ink-muted">
          צעדים משלכם לתהליך הזה — סמנו כשמתקדמים, וצרפו קבצים לכל צעד
        </p>
        <Card className="p-4">
          <TaskChecklist
            taskId={task.id}
            items={checklist}
            docs={stepDocs.map((d) => ({
              id: d.id,
              name: d.name,
              checklist_item_id: d.checklist_item_id,
              url: stepDocUrls.get(d.id),
            }))}
            docCategory={
              DOC_CATEGORY_BY_TASK_CATEGORY[template.category_id] ?? "other"
            }
          />
        </Card>
      </section>

      {/* meta: cost, time, docs needed */}
      {(template.est_cost || template.est_time || template.docs_needed.length > 0) && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {(template.est_cost || template.est_time) && (
            <Card className="p-4">
              {template.est_cost && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Banknote className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  <span>
                    <b>עלות:</b> {template.est_cost}
                  </span>
                </p>
              )}
              {template.est_time && (
                <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-soft">
                  <Clock className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  <span>
                    <b>זמן:</b> {template.est_time}
                  </span>
                </p>
              )}
            </Card>
          )}
          {template.docs_needed.length > 0 && (
            <Card className="p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="h-4 w-4 text-ink-faint" aria-hidden />
                מה להכין
              </p>
              <ul className="list-disc space-y-1 pr-5 text-sm text-ink-soft">
                {template.docs_needed.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* official links */}
      {template.official_links.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-bold text-ink">קישורים רשמיים</h2>
          <div className="flex flex-col gap-2">
            {template.official_links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-edge bg-card px-4 py-3 text-sm font-medium text-brand-strong transition hover:border-brand-300 hover:bg-brand-tint/50"
              >
                {link.label}
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-brand-500"
                  aria-hidden
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* smart in-app action */}
      {smartAction && <section className="mt-6">{smartAction}</section>}

      {/* partner offers / advertise slot */}
      <section className="mt-6">
        {offers.length > 0 ? (
          <>
            <h2 className="mb-3 font-bold text-ink">קיצור דרך</h2>
            <div className="flex flex-col gap-3">
              {offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          </>
        ) : (
          <AdvertiseCard context={template.title} />
        )}
      </section>

      {/* attached documents */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
          <Paperclip className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          המסמכים של המשימה
        </h2>
        <Card className="p-4">
          {documents.length > 0 && (
            <ul className="mb-3 divide-y divide-edge-soft">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 py-2 text-sm text-ink-soft">
                  <FileText className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  {doc.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mb-3 text-sm text-ink-muted">
            קיבלתם תעודה, אישור או פוליסה מהמשימה הזו? תייקו אותה כאן — והיא
            תישמר בארכיון המסמכים של העסק.
          </p>
          <DocumentUpload
            category={DOC_CATEGORY_BY_TASK_CATEGORY[template.category_id] ?? "other"}
            taskId={task.id}
            label="צירוף מסמך"
          />
        </Card>
      </section>

      {/* notes */}
      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">הערות שלי</h2>
        <NotesEditor taskId={task.id} initialNotes={task.notes ?? ""} />
      </section>

      {template.source_url && (
        <p className="mt-6 text-xs text-ink-faint">
          מבוסס על מקור רשמי · נבדק לאחרונה: {template.last_reviewed}
        </p>
      )}
      <Disclaimer />
    </div>
  );
}
