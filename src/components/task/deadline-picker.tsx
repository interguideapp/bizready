"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, Check, ExternalLink, Loader2, Scale, X } from "lucide-react";
import { setTaskDueDate } from "@/lib/actions";
import {
  deadlineOptions,
  deadlineWarning,
  formatHe,
  isDemandTriggered,
  onDemandDeadline,
  type DeadlineOption,
} from "@/lib/deadline-options";

/**
 * Setting a deadline without doing arithmetic.
 *
 * What this replaces was a bare `<input type="date">`. To say "remind me in two
 * weeks" you counted it out yourself; to line up with a statutory deadline you
 * had to already know the date — which the product knew and never offered. And
 * on a statutory task there was no editor at all, so on exactly the obligations
 * where people want a head start, there was no way to ask for one.
 *
 * Three kinds of date, kept visibly distinct because they carry different
 * authority:
 *
 *   המועד החוקי   from the filing-rules registry, with a source. Immovable.
 *   מהיום         relative. Ours, arbitrary, and no pretence otherwise.
 *   יעד אישי      what the user picks. Stored separately from the legal date
 *                 (migration 028) so neither can overwrite the other.
 */
export function DeadlinePicker({
  taskId,
  templateId,
  todayIso,
  personalDueDate,
  statutoryDueDate,
  onDone,
}: {
  taskId: string;
  templateId: string;
  todayIso: string;
  personalDueDate: string | null;
  statutoryDueDate: string | null;
  onDone: () => void;
}) {
  const [chosen, setChosen] = useState(personalDueDate ?? "");
  const [demandDate, setDemandDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = deadlineOptions({ templateId, todayIso, statutoryDueDate });
  const warning = deadlineWarning(chosen, statutoryDueDate);
  const demand = isDemandTriggered(templateId);
  const computedFromDemand = demandDate ? onDemandDeadline(templateId, demandDate) : null;

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setTaskDueDate(taskId, next);
        onDone();
      } catch {
        setError("לא הצלחנו לשמור את התאריך. נסו שוב.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <CalendarClock className="h-4 w-4 text-brand-400" aria-hidden />
        {personalDueDate ? "שינוי היעד" : "קביעת יעד"}
      </p>

      {/* The legal date, stated before anything the user might choose. It is
          the fact; everything else on this panel is a preference. */}
      {statutoryDueDate && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-brand-tint/40 p-2.5 text-xs leading-relaxed text-ink-soft">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" aria-hidden />
          <span>
            המועד החוקי לדיווח הזה הוא{" "}
            <b className="text-ink">{formatHe(statutoryDueDate)}</b> והוא לא
            משתנה. היעד שתקבעו כאן הוא לכם — נזכיר לכם בו, בנוסף למועד החוקי.
          </span>
        </p>
      )}

      {/* ---------- the offered dates ---------- */}
      <div
        role="group"
        aria-label="תאריכים מוצעים"
        className="mb-3 flex flex-wrap gap-1.5"
      >
        {options.map((o) => (
          <OptionChip
            key={o.id}
            option={o}
            active={chosen === o.date}
            onPick={() => setChosen(o.date)}
          />
        ))}
      </div>

      {/* ---------- a deadline that starts from a letter we cannot see ---------- */}
      {demand && (
        <div className="mb-3 rounded-xl border border-edge-soft bg-surface/50 p-3">
          <label
            htmlFor="demand-date"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            מתי קיבלתם את הדרישה? נחשב את המועד לפי הכלל
          </label>
          <input
            id="demand-date"
            type="date"
            value={demandDate}
            max={todayIso}
            onChange={(e) => setDemandDate(e.target.value)}
            className="w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
          {computedFromDemand && (
            <button
              onClick={() => setChosen(computedFromDemand.date)}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-edge bg-brand-tint px-3 py-2 text-sm font-semibold text-brand-strong"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {computedFromDemand.days} יום מהדרישה — {formatHe(computedFromDemand.date)}
            </button>
          )}
        </div>
      )}

      {/* ---------- anything else ---------- */}
      <label htmlFor="deadline-date" className="mb-1.5 block text-xs font-medium text-ink-muted">
        או תאריך אחר
      </label>
      <input
        id="deadline-date"
        type="date"
        value={chosen}
        onChange={(e) => setChosen(e.target.value)}
        className="mb-3 w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
      />

      {/* The one case worth interrupting for: a target that plans to be late. */}
      {warning && (
        <p
          role="status"
          className="mb-3 flex items-start gap-2 rounded-xl bg-status-overdue/10 p-2.5 text-xs leading-relaxed text-status-overdue"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {warning}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 text-xs text-status-overdue">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => chosen && save(chosen)}
          disabled={pending || !chosen}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          שמירה
        </button>
        {personalDueDate && (
          <button
            onClick={() => save(null)}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-status-overdue"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            הסרת היעד
          </button>
        )}
        <button
          onClick={onDone}
          className="inline-flex min-h-11 items-center px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

/**
 * One offered date.
 *
 * An official date shows its reasoning and its source, because a date the
 * product asserts on the law's behalf has to be checkable. A relative one shows
 * only the date it resolves to — there is nothing to cite about "in a week".
 */
function OptionChip({
  option,
  active,
  onPick,
}: {
  option: DeadlineOption;
  active: boolean;
  onPick: () => void;
}) {
  const official = option.kind === "official";
  return (
    <span className="inline-flex flex-col">
      <button
        onClick={onPick}
        aria-pressed={active}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-start text-sm transition ${
          active
            ? "border-brand-600 bg-brand-tint font-semibold text-brand-strong"
            : official
              ? "border-brand-edge bg-card text-ink-soft hover:border-brand-300"
              : "border-edge bg-card text-ink-soft hover:border-edge-strong"
        }`}
      >
        {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {official && !active && <Scale className="h-3.5 w-3.5 shrink-0 text-brand-strong" aria-hidden />}
        <span>
          {option.label}
          {/* An explicit space: JSX drops the whitespace between an expression
              and an element on separate lines, so without it a screen reader
              announces "בעוד שבוע19.9.2026" as one run-together word. */}
          {" "}
          <span className="tnum text-xs text-ink-muted">{formatHe(option.date)}</span>
        </span>
      </button>
      {official && (option.note || option.source) && (
        <span className="mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">
          {option.note}
          {option.source && (
            <a
              href={option.source}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-1 inline-flex items-center gap-0.5 text-brand-strong hover:underline"
            >
              מקור
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </span>
      )}
    </span>
  );
}
