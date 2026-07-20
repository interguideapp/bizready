"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/actions";
import { DocumentUpload } from "@/components/document-upload";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface StepDoc {
  id: string;
  name: string;
  checklist_item_id: string | null;
  url?: string;
}

/**
 * "הדרך שלי" — a personal checklist inside a task. The user adds their own
 * sub-steps, ticks them off, and attaches one or more files to each step
 * (files also land in the document archive).
 */
export function TaskChecklist({
  taskId,
  items,
  docs,
  docCategory,
}: {
  taskId: string;
  items: ChecklistItem[];
  docs: StepDoc[];
  docCategory: string;
}) {
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const done = items.filter((i) => i.done).length;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const text = label.trim();
    if (!text) return;
    startTransition(async () => {
      await addChecklistItem(taskId, text);
      setLabel("");
    });
  }

  return (
    <div>
      {items.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium text-ink-muted">
            {done}/{items.length} הושלמו
          </p>
          <ul className="mb-3 flex flex-col gap-1.5">
            {items.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                docs={docs.filter((d) => d.checklist_item_id === item.id)}
                docCategory={docCategory}
              />
            ))}
          </ul>
        </>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="הוספת צעד משלכם..."
          className="min-w-0 flex-1 rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
        />
        <button
          type="submit"
          disabled={pending || !label.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          הוספה
        </button>
      </form>
    </div>
  );
}

function ChecklistRow({
  item,
  docs,
  docCategory,
}: {
  item: ChecklistItem;
  docs: StepDoc[];
  docCategory: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-xl border border-edge-soft px-3 py-2">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() =>
            startTransition(() => toggleChecklistItem(item.id, !item.done))
          }
          aria-label={item.done ? "בטל סימון" : "סמן כבוצע"}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            item.done
              ? "border-status-done bg-status-done text-white"
              : "border-edge-strong bg-card"
          }`}
        >
          {item.done && <Check className="h-3.5 w-3.5" aria-hidden />}
        </button>
        <span
          className={`min-w-0 flex-1 text-sm ${
            item.done ? "text-ink-muted line-through" : "text-ink"
          }`}
        >
          {item.label}
        </span>
        <DocumentUpload
          category={docCategory}
          checklistItemId={item.id}
          icon
        />
        <button
          onClick={() => startTransition(() => deleteChecklistItem(item.id))}
          disabled={pending}
          aria-label="מחיקת צעד"
          className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-status-overdue"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {docs.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1 pr-7">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <FileText className="h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:text-brand-strong"
                >
                  {doc.name}
                </a>
              ) : (
                <span className="truncate">{doc.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
