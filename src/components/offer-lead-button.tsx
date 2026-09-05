"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, PhoneCall } from "lucide-react";
import { requestOfferLead } from "@/lib/actions";
import { toast } from "@/components/toaster";

/** "Have them call me" — logs an attributable lead for the partner. */
export function OfferLeadButton({ offerId }: { offerId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await requestOfferLead(offerId);
      if (res.ok) {
        setDone(true);
        toast.success("נרשם — השותף יחזור אליכם");
      } else {
        toast.error("לא הצלחנו לרשום את הבקשה");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-status-done-bg px-4 py-2.5 text-sm font-semibold text-status-done">
        <Check className="h-4 w-4" aria-hidden />
        נשלחה בקשה
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-edge bg-card px-4 py-2.5 text-sm font-semibold text-brand-strong transition hover:bg-brand-tint/40 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PhoneCall className="h-4 w-4" aria-hidden />}
      שיחזרו אליי
    </button>
  );
}
