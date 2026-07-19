"use client";

import { useTransition } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { deleteDocument } from "@/lib/actions";
import type { DocumentRow } from "@/lib/data";

export function DocumentRowItem({
  doc,
  signedUrl,
}: {
  doc: DocumentRow;
  signedUrl?: string;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`למחוק את "${doc.name}" מהארכיון?`)) return;
    startTransition(() => deleteDocument(doc.id));
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <FileText className="h-5 w-5 shrink-0 text-brand-400" aria-hidden />
      <div className="min-w-0 flex-1">
        {signedUrl ? (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-ink hover:text-brand-strong"
          >
            {doc.name}
          </a>
        ) : (
          <span className="block truncate text-sm font-medium text-ink">
            {doc.name}
          </span>
        )}
        <p className="text-xs text-ink-faint">
          {new Date(doc.created_at).toLocaleDateString("he-IL")}
          {doc.expires_at &&
            ` · בתוקף עד ${new Date(doc.expires_at).toLocaleDateString("he-IL")}`}
        </p>
      </div>
      <button
        onClick={remove}
        disabled={pending}
        aria-label={`מחיקת ${doc.name}`}
        className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-status-overdue"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
