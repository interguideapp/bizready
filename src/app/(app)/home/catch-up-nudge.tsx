"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Loader2 } from "lucide-react";
import { setBusinessStage } from "@/lib/actions";
import { toast } from "@/components/toaster";

/**
 * "כבר טיפלתם בחלק מזה?" — with a way to answer no.
 *
 * The card fires when the business is marked ACTIVE and not one task has ever
 * been closed, which is a contradiction worth raising. But the first version
 * had no "no", so an owner who really has just started — and described
 * themselves as active — would have been asked again on every visit to the home
 * screen, forever. An unanswerable question is an alarm with no off switch, and
 * this session removed two of those before noticing it had just built a third.
 *
 * Answering no is not a dismissal. It is the correction the contradiction
 * implies: if nothing has been done, the business is not yet active. So it
 * changes the answer, which reconciles the plan and fills in the recommended
 * dates this business should have had — rather than hiding a card and leaving
 * the wrong answer in place.
 */
export function CatchUpNudge() {
  const [pending, startTransition] = useTransition();

  function stillSettingUp() {
    startTransition(async () => {
      try {
        await setBusinessStage("setting_up");
        toast.success("עדכנו את השלב — התכנית חושבה מחדש");
      } catch {
        toast.error("העדכון נכשל — אפשר לשנות את השלב בהגדרות");
      }
    });
  }

  return (
    <div className="os-card rounded-3xl border border-brand-edge p-5">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardCheck className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        <h2 className="text-section text-ink">כבר טיפלתם בחלק מזה?</h2>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">
        {/*
          A question, and it states the ground it stands on so the ask is
          checkable. The inference can be wrong: someone who genuinely just
          started and called themselves active has done nothing yet, and
          asserting their records are stale would be false.
        */}
        העסק מוגדר כפעיל, ועדיין לא סומנה אף משימה כבוצעה. אם חלק מזה כבר מסודר
        — סמנו והציון, הדדליינים וההתראות יחושבו מחדש לפי המצב האמיתי.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/catch-up"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          מה כבר קיים בעסק
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <button
          onClick={stillSettingUp}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-edge px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:border-brand-edge hover:text-brand-strong disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          לא, העסק עוד בהקמה
        </button>
      </div>
    </div>
  );
}
