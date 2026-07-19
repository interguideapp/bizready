import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Clock,
  ExternalLink,
  FileText,
  Lightbulb,
  ListTodo,
  Paperclip,
} from "lucide-react";
import { DueBadge, PriorityBadge } from "@/components/badges";
import { CategoryIcon } from "@/components/category-icon";
import { DocumentUpload } from "@/components/document-upload";
import { OfferCard } from "@/components/offer-card";
import { StepsContent } from "@/components/steps-content";
import { NotesEditor, StatusPicker } from "@/components/task-controls";
import { Card, Disclaimer } from "@/components/ui";
import { CATEGORIES_BY_ID, TEMPLATES_BY_ID } from "@/lib/content";
import {
  getBusiness,
  getBusinessTasks,
  getDocuments,
  getOffersForTemplate,
} from "@/lib/data";

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

  const [allDocs, offers] = await Promise.all([
    getDocuments(business.id),
    getOffersForTemplate(template.id),
  ]);
  const documents = allDocs.filter((d) => d.task_id === task.id);
  const category = CATEGORIES_BY_ID.get(template.category_id)!;

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
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
        כל המשימות
      </Link>

      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <CategoryIcon name={category.icon} className="h-4 w-4" />
          {category.title}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{template.title}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={template.priority} />
          {task.status !== "done" && <DueBadge dueDate={task.due_date} />}
          {template.recurrence && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
              {template.recurrence === "monthly"
                ? "משימה חודשית"
                : template.recurrence === "bimonthly"
                  ? "אחת לחודשיים"
                  : "משימה שנתית"}
            </span>
          )}
        </div>
      </header>

      {/* status */}
      <Card className="p-4">
        <StatusPicker taskId={task.id} status={task.status} />
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
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 hover:text-slate-900"
                >
                  {depTemplate.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* why */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-900">
          <Lightbulb className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          למה זה חשוב
        </h2>
        <p className="leading-relaxed text-slate-700">{template.why}</p>
      </section>

      {/* steps */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
          <ListTodo className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          איך עושים את זה
        </h2>
        <Card className="p-5">
          <StepsContent text={template.steps} />
        </Card>
      </section>

      {/* meta: cost, time, docs needed */}
      {(template.est_cost || template.est_time || template.docs_needed.length > 0) && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {(template.est_cost || template.est_time) && (
            <Card className="p-4">
              {template.est_cost && (
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <Banknote className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span>
                    <b>עלות:</b> {template.est_cost}
                  </span>
                </p>
              )}
              {template.est_time && (
                <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-700">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span>
                    <b>זמן:</b> {template.est_time}
                  </span>
                </p>
              )}
            </Card>
          )}
          {template.docs_needed.length > 0 && (
            <Card className="p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                מה להכין
              </p>
              <ul className="list-disc space-y-1 pr-5 text-sm text-slate-600">
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
          <h2 className="mb-3 font-bold text-slate-900">קישורים רשמיים</h2>
          <div className="flex flex-col gap-2">
            {template.official_links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                {link.label}
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500"
                  aria-hidden
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* partner offers */}
      {offers.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-bold text-slate-900">קיצור דרך</h2>
          <div className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      )}

      {/* attached documents */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
          <Paperclip className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          המסמכים של המשימה
        </h2>
        <Card className="p-4">
          {documents.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 py-2 text-sm text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {doc.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mb-3 text-sm text-slate-500">
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
        <h2 className="mb-3 font-bold text-slate-900">הערות שלי</h2>
        <NotesEditor taskId={task.id} initialNotes={task.notes ?? ""} />
      </section>

      {template.source_url && (
        <p className="mt-6 text-xs text-slate-400">
          מבוסס על מקור רשמי · נבדק לאחרונה: {template.last_reviewed}
        </p>
      )}
      <Disclaimer />
    </div>
  );
}
