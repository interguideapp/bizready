import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";
import { DocumentUpload } from "@/components/document-upload";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { getBusiness, getDocuments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DOC_GENERATORS } from "@/lib/documents/generators";
import type { OnboardingAnswers } from "@/lib/types";
import { DocumentRowItem } from "./document-row";

const DOC_CATEGORIES: { id: string; label: string }[] = [
  { id: "registration", label: "רישום ואישורים" },
  { id: "tax", label: "מיסים" },
  { id: "insurance", label: "ביטוחים" },
  { id: "agreements", label: "הסכמים ומשפט" },
  { id: "other", label: "כללי" },
];

export default async function DocumentsPage() {
  const business = (await getBusiness())!;
  const documents = await getDocuments(business.id);
  const supabase = await createClient();

  // signed URLs for viewing (1 hour)
  const signedUrls = new Map<string, string>();
  if (documents.length > 0) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrls(
        documents.map((d) => d.storage_path),
        3600
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
      <PageTitle
        title="ארכיון המסמכים"
        subtitle="תעודות, אישורים ופוליסות — מתויקים ובמרחק קליק"
      />

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
                    <span className="mr-2 font-normal text-ink-faint">
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
