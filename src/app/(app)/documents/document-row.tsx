"use client";

import { useTransition } from "react";
import { ExternalLink, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { deleteDocument, updateDocument } from "@/lib/actions";
import { toast } from "@/components/toaster";
import type { DocumentRow } from "@/lib/data";

export function DocumentRowItem({
  doc,
  signedUrl,
  taskTitle,
  tasks,
}: {
  doc: DocumentRow;
  signedUrl?: string;
  taskTitle?: string | null;
  tasks: { id: string; title: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`למחוק את "${doc.name}" מהארכיון?`)) return;
    startTransition(() => deleteDocument(doc.id));
  }

  function associate(taskId: string) {
    startTransition(async () => {
      await updateDocument(doc.id, { taskId: taskId || null });
      toast.success(taskId ? "הקובץ שויך למשימה" : "השיוך הוסר");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="h-5 w-5 shrink-0 text-brand-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
        <p className="text-xs text-ink-faint">
          {new Date(doc.created_at).toLocaleDateString("he-IL")}
          {doc.expires_at && ` · בתוקף עד ${new Date(doc.expires_at).toLocaleDateString("he-IL")}`}
          {taskTitle && (
            <span className="text-brand-strong"> · שייך ל{taskTitle}</span>
          )}
        </p>
      </div>

      {/* associate to a task */}
      <label className="relative inline-flex items-center">
        <Link2 className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ink-faint" aria-hidden />
        <select
          value={doc.task_id ?? ""}
          onChange={(e) => associate(e.target.value)}
          disabled={pending}
          aria-label="שיוך למשימה"
          className="max-w-[9rem] rounded-lg border border-edge bg-card py-1 pr-6 pl-2 text-xs text-ink-soft outline-none transition focus:border-brand-500"
        >
          <option value="">ללא שיוך</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>

      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`צפייה ב-${doc.name}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-brand-strong transition hover:border-brand-300"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          צפייה
        </a>
      )}

      <button
        onClick={remove}
        disabled={pending}
        aria-label={`מחיקת ${doc.name}`}
        className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-status-overdue"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
