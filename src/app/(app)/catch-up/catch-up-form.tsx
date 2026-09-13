"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { applyCatchUp } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { Card } from "@/components/ui";
import type { CatchUpItem, CatchUpMark } from "@/lib/catch-up";

/**
 * "What does the business already have?", asked over the real plan.
 *
 * Two answers per row rather than a checkbox, because they mean different
 * things to the engines and the difference is the whole point of the dismissal
 * split: "עשיתי את זה" closes the task, while "רו״ח מטפל" records that it is
 * handled elsewhere — which SATISFIES a dependency, so a duty gated behind it
 * opens. Collapsing both into one tick would have made the second invisible.
 */
export function CatchUpForm({
  groups,
}: {
  groups: { categoryId: string; title: string; items: CatchUpItem[] }[];
}) {
  const [marks, setMarks] = useState<Record<string, CatchUpMark>>({});
  const [pending, startTransition] = useTransition();

  const chosen = useMemo(() => Object.keys(marks).length, [marks]);

  function set(templateId: string, mark: CatchUpMark) {
    setMarks((m) => {
      const next = { ...m };
      // Clicking the same answer again clears it, so a mis-tap is undoable
      // without reloading and losing every other answer on the page.
      if (next[templateId] === mark) delete next[templateId];
      else next[templateId] = mark;
      return next;
    });
  }

  function submit() {
    if (chosen === 0) return;
    startTransition(async () => {
      try {
        const res = await applyCatchUp(
          Object.entries(marks).map(([templateId, mark]) => ({ templateId, mark }))
        );
        const parts: string[] = [];
        if (res.done > 0) parts.push(res.done === 1 ? "משימה אחת נסגרה" : `${res.done} משימות נסגרו`);
        if (res.handled > 0)
          parts.push(
            res.handled === 1 ? "אחת סומנה כמטופלת בחוץ" : `${res.handled} סומנו כמטופלות בחוץ`
          );
        toast.success(parts.join(" · ") || "לא היה מה לעדכן");
        setMarks({});
      } catch {
        // The whole pass failing silently would be the worst outcome here: the
        // user believes the plan now reflects reality and it does not.
        toast.error("העדכון נכשל — אפשר לנסות שוב");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.categoryId} className="p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-soft">{group.title}</h2>
          <ul className="flex flex-col divide-y divide-edge-soft">
            {group.items.map((item) => {
              const mark = marks[item.templateId];
              return (
                <li
                  key={item.templateId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm text-ink">{item.title}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <Answer
                      active={mark === "done"}
                      onClick={() => set(item.templateId, "done")}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                      label="עשיתי"
                      tone="done"
                    />
                    <Answer
                      active={mark === "handled_externally"}
                      onClick={() => set(item.templateId, "handled_externally")}
                      icon={<UserCheck className="h-3.5 w-3.5" aria-hidden />}
                      label="מטופל בחוץ"
                      tone="external"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      <div className="sticky bottom-24 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={chosen === 0 || pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          עדכון התכנית
        </button>
        <span className="text-xs text-ink-muted">
          {chosen === 0
            ? "בחרו מה שכבר טופל"
            : chosen === 1
              ? "פריט אחד נבחר"
              : `${chosen} פריטים נבחרו`}
        </span>
      </div>
    </div>
  );
}

function Answer({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "done" | "external";
}) {
  const activeClass =
    tone === "done"
      ? "border-status-done bg-status-done-bg text-status-done"
      : "border-brand-edge bg-brand-tint text-brand-strong";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        active ? activeClass : "border-edge text-ink-muted hover:border-edge-strong"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
