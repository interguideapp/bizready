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
  // The task list is only materialised into <option> elements once the user
  // actually reaches for this select. Every row used to render all 70 options
  // eagerly, so a 100-document archive built 7,000 option nodes on load — for a
  // control most people never touch.
  const [optionsReady, setOptionsReady] = useState(false);

  function remove() {
    // Was window.confirm: the browser's own LTR dialog with English OS buttons,
    // which breaks the RTL illusion completely at the moment a user tries to
    // delete something.
    setConfirmOpen(false);
    startTransition(() => deleteDocument(doc.id));
  }

  const currentTask = doc.task_id ? tasks.find((t) => t.id === doc.task_id) : undefined;

  // Compared as date strings, not Date objects: an expiry is a calendar day,
  // and comparing it against a local clock is how "today" became "yesterday"
  // for three hours every night before todayInIsrael existed. The client cannot
  // call that helper, but a lexicographic compare of two yyyy-mm-dd strings has
  // no timezone in it at all.
  const expired = doc.expires_at
    ? doc.expires_at < new Date().toLocaleDateString("sv-SE")
    : false;

  function associate(taskId: string) {
    startTransition(async () => {
      await updateDocument(doc.id, { taskId: taskId || null });
      toast.success(taskId ? "הקובץ שויך למשימה" : "השיוך הוסר");
    });
  }

  function setExpiry(value: string) {
    startTransition(async () => {
      try {
        await updateDocument(doc.id, { expiresAt: value || null });
        // Say what the date DOES, not that a field was saved. A user who has
        // just told us a certificate expires wants to know the product will act
        // on it — that is the entire reason to type it in.
        toast.success(value ? "נזכיר לכם לפני התפוגה" : "תאריך התפוגה הוסר");
      } catch {
        toast.error("לא הצלחנו לשמור את תאריך התפוגה");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="h-5 w-5 shrink-0 text-brand-400" aria-hidden />
      {/* basis-full below sm: the row carries three shrink-0 controls now, and
          measured at 375px this column collapsed to FOUR pixels — the document's
          own name squeezed out by the controls that act on it. Taking a full
          line on a narrow screen lets them wrap underneath instead. */}
      <div className="min-w-0 flex-1 basis-full sm:basis-0">
        <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
        <p className="text-xs text-ink-faint">
          {new Date(doc.created_at).toLocaleDateString("he-IL")}
          {/* An EXPIRED document read exactly like a valid one — neutral grey,
              "בתוקף עד 1.6.2026", three months after it stopped being valid.
              The archive is where a user goes to check they are covered, so it
              has to be the screen that says they are not. */}
          {doc.expires_at &&
            (expired ? (
              <span className="font-medium text-status-overdue">
                {" · פג תוקף ב-"}
                {new Date(doc.expires_at + "T00:00:00").toLocaleDateString("he-IL")}
              </span>
            ) : (
              ` · בתוקף עד ${new Date(doc.expires_at + "T00:00:00").toLocaleDateString("he-IL")}`
            ))}
          {taskTitle && (
            <span className="text-brand-strong"> · שייך ל{taskTitle}</span>
          )}
        </p>
      </div>

      {/* associate to a task */}
      <span className="relative inline-flex items-center">
        <Link2 className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-ink-faint" aria-hidden />
        <select
          value={doc.task_id ?? ""}
          onChange={(e) => associate(e.target.value)}
          onMouseDown={() => setOptionsReady(true)}
          onFocus={() => setOptionsReady(true)}
          onTouchStart={() => setOptionsReady(true)}
          disabled={pending}
          aria-label="שיוך למשימה"
          className="min-h-11 max-w-[9rem] rounded-lg border border-edge bg-card py-1 ps-6 pe-2 text-xs text-ink-soft outline-none transition focus:border-brand-500"
        >
          <option value="">ללא שיוך</option>
          {optionsReady ? (
            tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))
          ) : (
            // Until then, only the currently selected option needs to exist —
            // otherwise the control would render blank for an assigned document.
            currentTask && (
              <option value={currentTask.id}>{currentTask.title}</option>
            )
          )}
        </select>
      </span>

      {/* WHEN THIS EXPIRES.
          compliance.ts builds a document_expiry obligation from this column,
          document-row rendered it, and the evidence pack exported it — while no
          input anywhere in the product could set it. So the whole branch was
          unreachable from shipped UI, and an אישור ניהול ספרים or a licence
          could expire with the board silent. Same defect the audit found for
          renewal dates on task completion. */}
      <label className="inline-flex shrink-0 items-center gap-1.5">
        {/* A visible label, not just an aria one. Seen in a browser: an empty
            date box sat between "ללא שיוך" and "צפייה" saying nothing at all,
            so there was no way to know what it was for. And no icon of ours —
            the native date input draws its own calendar button, and mine
            overlapped it. */}
        <span className="whitespace-nowrap text-xs font-medium text-ink-muted">בתוקף עד</span>
        <input
          type="date"
          defaultValue={doc.expires_at ?? ""}
          onChange={(e) => setExpiry(e.target.value)}
          disabled={pending}
          aria-label={`תוקף המסמך ${doc.name}`}
          className="min-h-11 rounded-lg border border-edge bg-card px-2 py-1 text-xs text-ink-soft outline-none transition focus:border-brand-500"
        />
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
