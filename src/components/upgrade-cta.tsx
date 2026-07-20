"use client";

import { useTransition } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { startProTrial } from "@/lib/actions";
import { PRO_FEATURES, TRIAL_DAYS } from "@/lib/subscription";

/** The paywall / upgrade card for the Compliance Guardian. */
export function UpgradeCta({ compact = false }: { compact?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-edge bg-gradient-to-l from-brand-tint/70 to-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-bold text-ink">BizReady Pro — שומר הדדליינים</p>
          <p className="text-xs text-ink-muted">
            שנשמור עליכם אקטיבית שלא תפספסו אף הגשה, חידוש או תקרה
          </p>
        </div>
      </div>

      {!compact && (
        <ul className="my-4 flex flex-col gap-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-done" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => startTransition(() => startProTrial())}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        התחלת ניסיון {TRIAL_DAYS} ימים חינם
      </button>
      <p className="mt-2 text-xs text-ink-faint">
        ללא כרטיס אשראי · אפשר לבטל בכל רגע
      </p>
    </div>
  );
}
