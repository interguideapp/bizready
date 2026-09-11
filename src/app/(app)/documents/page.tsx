import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";
import { DocumentUpload } from "@/components/document-upload";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import {
  DOCUMENTS_PAGE_SIZE,
  requireBusiness,
  getBusinessTasks,
  getDocuments,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { DOC_GENERATORS } from "@/lib/documents/generators";
import type { OnboardingAnswers } from "@/lib/types";
import { BusinessHubTabs } from "@/components/business-hub-tabs";
import { DocumentRowItem } from "./document-row";

const DOC_CATEGORIES: { id: string; label: string }[] = [
  { id: "registration", label: "רישום ואישורים" },
  { id: "tax", label: "מיסים" },
  { id: "insurance", label: "ביטוחים" },
  { id: "agreements", label: "הסכמים ומשפט" },
  { id: "other", label: "כללי" },
];

export default async function DocumentsPage() {
  const business = await requireBusiness();
  const [fetched, tasks] = await Promise.all([
    getDocuments(business.id),
    getBusinessTasks(business.id),
  ]);
  // getDocuments fetches one past the cap so we can tell "exactly the cap" from
  // "more than the cap" and say which, rather than truncating in silence.
  const truncated = fetched.length > DOCUMENTS_PAGE_SIZE;
  const documents = truncated ? fetched.slice(0, DOCUMENTS_PAGE_SIZE) : fetched;
  const supabase = await createClient();

  // task association: options + a lookup for the current link
  const taskOptions = tasks
    .filter((t) => t.is_relevant && TEMPLATES_BY_ID.has(t.template_id))
    .map((t) => ({ id: t.id, title: TEMPLATES_BY_ID.get(t.template_id)!.title }))
    .sort((a, b) => a.title.localeCompare(b.title, "he"));
  const taskTitleById = new Map(taskOptions.map((t) => [t.id, t.title]));

  // signed URLs for viewing
  const signedUrls = new Map<string, string>();
  if (documents.length > 0) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(
        documents.map((d) => d.storage_path),
        // 300s, not 3600s. These point at scanned tax returns and ID documents,
        // and a signed URL embedded as an href outlives the page it rendered on
        // — it stays in history and in any screenshot of the address bar.
        300
      );
    data?.forEach((entry, i) => {
      if (entry.signedUrl) signedUrls.set(documents[i].id, entry.signedUrl);
    });
  }

  const genCtx = {
    businessName: business.name,
    entityType: business.entity_type,
    dealerNumber: business.dealer_number,
    field: business.field,
    answers: business.onboarding_answers as OnboardingAnswers,
  };
  const generators = DOC_GENERATORS.filter(
    (g) => !g.isRelevant || g.isRelevant(genCtx)
  );

  return (
    <div>
      <BusinessHubTabs />
      <PageTitle
        title="מסמכים"
        subtitle="תעודות, אישורים ופוליסות — מתויקים ובמרחק קליק"
      />

      {/* Said out loud rather than silently dropped. A vault that quietly stops
          showing your oldest certificates is worse than one that admits it. */}
      {truncated && (
        <p className="mb-4 rounded-xl border border-edge bg-surface-2 px-4 py-2.5 text-xs leading-relaxed text-ink-muted">
          מוצגים {DOCUMENTS_PAGE_SIZE} המסמכים האחרונים. יש לכם יותר — הישנים
          יותר שמורים ונכללים בייצוא הנתונים המלא בהגדרות.
        </p>
      )}

      {generators.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-soft">
            <Sparkles className="h-4 w-4 text-brand-strong" aria-hidden />
            מחוללי מסמכים — הפקה מוכנה מפרטי העסק
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {generators.map((g) => (
              <Link
                key={g.id}
                href={`/tasks/${g.templateId}`}
                className="rounded-2xl border border-brand-edge bg-brand-tint/40 p-4 transition hover:border-brand-300 hover:bg-brand-tint/70"
              >
                <p className="font-semibold text-ink">{g.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {g.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" aria-hidden />}
            title="עוד אין כאן מסמכים"
            subtitle="כשתקבלו תעודת עוסק, פוליסה או אישור — תייקו אותו כאן ותמצאו אותו בשנייה כשצריך"
            action={<DocumentUpload category="other" label="העלאת מסמך ראשון" />}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {DOC_CATEGORIES.map((cat) => {
            const docs = documents.filter((d) => d.category === cat.id);
            return (
              <section key={cat.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink-soft">
                    {cat.label}
                    <span className="ms-2 font-normal text-ink-faint">
                      {docs.length > 0 && `(${docs.length})`}
                    </span>
                  </h2>
                  <DocumentUpload category={cat.id} label="העלאה" compact />
                </div>
                {docs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-edge px-4 py-3 text-xs text-ink-faint">
                    ריק בינתיים
                  </p>
                ) : (
                  <Card className="divide-y divide-edge-soft">
                    {docs.map((doc) => (
                      <DocumentRowItem
                        key={doc.id}
                        doc={doc}
                        signedUrl={signedUrls.get(doc.id)}
                        taskTitle={doc.task_id ? taskTitleById.get(doc.task_id) : null}
                        tasks={taskOptions}
                      />
                    ))}
                  </Card>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
