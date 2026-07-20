"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-dismissed";

/**
 * Registers the service worker and offers "add to home screen" once the
 * browser says the app is installable. Dismissal is remembered.
 */
export function PwaSetup() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW is an enhancement — the app works fine without it */
      });
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* private mode */
      }
      setDeferred(e as InstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDeferred(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (!deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-sm rounded-2xl border border-edge bg-card p-4 shadow-lg backdrop-blur-xl md:bottom-4 md:right-auto md:left-4 md:mx-0">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            להתקין את BizReady בטלפון?
          </p>
          <p className="text-xs text-ink-muted">
            גישה מהירה למשימות ולתזכורות, כמו אפליקציה רגילה
          </p>
          <button
            onClick={install}
            className="mt-2.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            התקנה
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="לא עכשיו"
          className="shrink-0 rounded-lg p-1 text-ink-faint transition hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
