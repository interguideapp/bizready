"use client";

import { useTransition } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { cancelPro } from "@/lib/actions";
import { Card } from "@/components/ui";
import { aheadLabel } from "@/lib/he-distance";
import type { SubscriptionState } from "@/lib/subscription";
import { formatHeMoment } from "@/lib/dates";

export function SubscriptionBlock({
  until,
  state,
  daysLeft,
}: {
  until: string | null;
  /** From subscriptionStanding, so this block and the Pro gate agree. */
  state: SubscriptionState;
  daysLeft: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const endingSoon = state === "ending_soon";
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <ShieldCheck className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        BizReady Pro פעיל
      </h2>
      <p className="mb-3 text-sm text-ink-muted">
        {/* Describes what the subscription INCLUDES, not what is running right
            now. "עובד בשבילכם" is a claim about the sweep, and this block has
            no idea whether the sweep is running — the obligations board and the
            notifications page do, and they say so there. */}
        שומר הדדליינים כלול במנוי שלכם.
        {/*
          Said "הניסיון בתוקף עד" for everyone. subscription_until is the end of
          the CURRENT BILLING PERIOD — periodEndIso writes it for every granting
          subscription — so a paying monthly subscriber was told their paid plan
          was a trial expiring in a month. Nothing here knows trial from paid,
          so this says only what is true of both.
        */}
        {until &&
          ` התקופה הנוכחית בתוקף עד ${formatHeMoment(until)}.`}
      </p>
      {endingSoon && daysLeft !== null && (
        /*
          The product warns about every deadline the user has and, until this,
          none of its own — while the period end is the deadline that decides
          whether the other warnings keep arriving at all. When Pro ends the
          escalating windows narrow to the free set, so a silent lapse takes the
          reminders with it. aheadLabel is the same distance vocabulary the
          obligations board uses, so "בעוד 3 ימים" means the same thing here.
        */
        <p
          role="status"
          className="mb-3 flex items-start gap-2 rounded-xl border border-status-progress/40 bg-status-progress/5 px-3 py-2.5 text-sm text-ink"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-status-progress"
            aria-hidden
          />
          <span>
            התקופה מסתיימת {aheadLabel(daysLeft)}. אם החיוב הבא לא יעבור, שומר
            הדדליינים יחזור למסלול החינמי — עם פחות תזכורות מקדימות.
          </span>
        </p>
      )}
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
