"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { deleteDocument, updateDocument } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  function remove() {
    // Was window.confirm: the browser's own LTR dialog with English OS buttons,
    // which breaks the RTL illusion completely at the moment a user tries to
    // delete something.
    setConfirmOpen(false);
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
      <span className="relative inline-flex items-center">
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
      </span>

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
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-label={`מחיקת ${doc.name}`}
        // 44px target: deleting a document is destructive and was a 26px hit area.
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-status-overdue"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="למחוק את הקובץ מהארכיון?"
        body={`"${doc.name}" יוסר מתיק העסק. אם הקובץ משמש כאסמכתא למשימה שהושלמה — כדאי לשמור אותו.`}
        confirmLabel="מחיקה"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
