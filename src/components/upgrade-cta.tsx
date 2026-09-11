"use client";

import { useState, useTransition } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { startProCheckout } from "@/lib/actions";
import { FormMessage } from "@/components/form";
import { Button } from "@/components/primitives";
import { PRO_FEATURES } from "@/lib/subscription";

/**
 * The paywall / upgrade card.
 *
 * The button used to be permanently disabled because the only upgrade path was
 * a self-serve free trial that had to be switched off. It now opens a real
 * Stripe Checkout session — and when billing is not configured the server says
 * so in words, rather than the UI guessing.
 */
export function UpgradeCta({ compact = false }: { compact?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upgrade() {
    setError(null);
    startTransition(async () => {
      const result = await startProCheckout();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Stripe's hosted page. Deliberately a full navigation rather than a
      // popup, so the payment happens on Stripe's own origin.
      window.location.href = result.url;
    });
  }

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

      {error && (
        <div className="mb-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}

      <Button onClick={upgrade} loading={pending} icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
        שדרוג ל-Pro
      </Button>
      <p className="mt-2 text-xs text-ink-soft">
        התשלום מתבצע באתר המאובטח של Stripe. אפשר לבטל בכל עת.
      </p>
    </div>
  );
}
