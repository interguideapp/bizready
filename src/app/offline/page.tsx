import { WifiOff } from "lucide-react";

export const metadata = { title: "אין חיבור — BizReady" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
        <WifiOff className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-lg font-bold text-ink">אין חיבור לאינטרנט</h1>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">
        התכנית שלך מחכה — ברגע שהחיבור יחזור, רעננו את הדף
      </p>
    </div>
  );
}
