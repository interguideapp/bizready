"use client";

import { useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { cancelPro } from "@/lib/actions";
import { Card } from "@/components/ui";

export function SubscriptionBlock({
  until,
}: {
  until: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <ShieldCheck className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        BizReady Pro פעיל
      </h2>
      <p className="mb-3 text-sm text-ink-muted">
        שומר הדדליינים עובד בשבילכם.
        {until &&
          ` הניסיון בתוקף עד ${new Date(until).toLocaleDateString("he-IL")}.`}
      </p>
      <button
        onClick={() => startTransition(() => cancelPro())}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-edge px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:border-status-overdue hover:text-status-overdue disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        ביטול Pro
      </button>
    </Card>
  );
}
