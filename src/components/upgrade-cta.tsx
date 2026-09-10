"use client";

import { Check, ShieldCheck } from "lucide-react";
import { PRO_FEATURES } from "@/lib/subscription";

/** The paywall / upgrade card for the Compliance Guardian. */
export function UpgradeCta({ compact = false }: { compact?: boolean }) {
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
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-brand-600/50 px-6 py-2.5 text-sm font-semibold text-white"
      >
        השדרוג ייפתח בקרוב
      </button>
      <p className="mt-2 text-xs text-ink-soft">
        אנחנו מחברים את התשלום. עד אז — כל מה שיש במערכת פתוח לכם.
      </p>
    </div>
  );
}
