"use client";

import { useState } from "react";
import {
  Check,
  FileText,
  Loader2,
  Lock,
  Printer,
  Save,
  Sparkles,
} from "lucide-react";
import { addDocument } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { renderDocHtml, type GeneratedDoc } from "@/lib/documents/generators";
import { UpgradeCta } from "@/components/upgrade-cta";
import { Card } from "@/components/ui";

/**
 * Turns the business profile into a real, ready document. Free users see a
 * live preview + the paywall; Pro can print it to PDF and file it in the vault.
 */
export function DocumentGenerator({
  generatorId,
  title,
  description,
  doc,
  businessName,
  category,
  taskId,
  isPro,
}: {
  generatorId: string;
  title: string;
  description: string;
  doc: GeneratedDoc;
  businessName: string;
  category: string;
  taskId: string;
  isPro: boolean;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const visibleSections = isPro ? doc.sections : doc.sections.slice(0, 1);

  async function saveToVault() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("לא מחוברים");

      const html = renderDocHtml(doc, businessName);
      const name = `${doc.title} — ${businessName}.html`;
      const path = `${user.id}/${crypto.randomUUID()}-${generatorId}.html`;
      const blob = new Blob([html], { type: "text/html" });
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, blob, { contentType: "text/html" });
      if (error) throw new Error(error.message);

      await addDocument({
        category,
        name,
        storage_path: path,
        mime_type: "text/html",
        task_id: taskId,
      });
      setSaveState("saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "השמירה נכשלה");
      setSaveState("error");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-edge-soft bg-brand-tint/40 px-5 py-4">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          <Sparkles className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
          יצירת מסמך: {title}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>

      {/* live preview */}
      <div className="relative px-5 py-4">
        <div className="rounded-xl border border-edge bg-card p-5" dir="rtl">
          <p className="border-b border-edge-soft pb-2 text-lg font-bold text-ink">
            {doc.title}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {businessName} · {doc.updatedLabel}
          </p>
          {doc.intro && (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {doc.intro}
            </p>
          )}
          {visibleSections.map((s, i) => (
            <div key={i} className="mt-3">
              {s.heading && (
                <p className="text-sm font-semibold text-ink">{s.heading}</p>
              )}
              {s.paragraphs.map((p, j) => (
                <p key={j} className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
            </div>
          ))}

          {!isPro && doc.sections.length > 1 && (
            <div className="pointer-events-none mt-2 h-16 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>

        {!isPro && (
          <p className="mt-2 text-center text-xs text-ink-faint">
            תצוגה מקדימה · הפקת המסמך המלא, הורדה ל-PDF ותיוק בארכיון — ב-Pro
          </p>
        )}
      </div>

      {/* actions */}
      <div className="border-t border-edge-soft px-5 py-4">
        {isPro ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/api/documents/print/${generatorId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Printer className="h-4 w-4" aria-hidden />
              שמירה כ-PDF / הדפסה
            </a>
            <button
              onClick={saveToVault}
              disabled={saveState === "saving" || saveState === "saved"}
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-card px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong disabled:opacity-60"
            >
              {saveState === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : saveState === "saved" ? (
                <Check className="h-4 w-4 text-status-done" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {saveState === "saved" ? "נשמר בארכיון" : "שמירה לארכיון"}
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              המסמך נשמר תחת המשימה ובארכיון המסמכים
            </span>
            {saveState === "error" && (
              <p className="w-full text-xs text-status-overdue">{errorMsg}</p>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
              <Lock className="h-4 w-4 text-ink-faint" aria-hidden />
              הפקת המסמך המלא זמינה ב-Pro
            </p>
            <UpgradeCta compact />
          </div>
        )}
      </div>
    </Card>
  );
}
