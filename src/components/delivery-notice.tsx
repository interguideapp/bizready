import Link from "next/link";
import { RadioTower } from "lucide-react";
import type { SweepHealth } from "@/lib/heartbeat";

/**
 * Outbound reminders are not going out — said as a fact, on the screens where
 * a user would otherwise assume they are.
 *
 * The previous version of this notice lived only on /notifications and inferred
 * the outage from "some items on this page were derived rather than stored",
 * which is a proxy: it could not appear when nothing happened to be
 * outstanding, and it had to hedge ("עד שנוודא שהשליחה עובדת"). The heartbeat
 * knows, so this states it.
 *
 * The second sentence is the important one. A user learning that reminders are
 * down needs to know what IS still true — every screen derives its own answer,
 * so nothing here is missing — otherwise the honest disclosure reads as "the
 * product is broken, trust nothing".
 */
export function DeliveryNotice({
  health,
  compact = false,
}: {
  health: SweepHealth;
  /** One line, for a screen whose job is not notifications. */
  compact?: boolean;
}) {
  const since =
    health.state === "never"
      ? "עדיין לא נשלחו התראות אוטומטיות"
      : health.hoursSince !== null && health.hoursSince >= 48
        ? `לא נשלחו התראות אוטומטיות מזה ${Math.floor(health.hoursSince / 24)} ימים`
        : "ההתראות האוטומטיות לא נשלחות כרגע";

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-status-progress/30 bg-status-progress-bg/40 p-3.5">
      <RadioTower className="mt-0.5 h-4 w-4 shrink-0 text-status-progress" aria-hidden />
      <p className="text-sm leading-relaxed text-ink-soft">
        <b className="text-ink">{since}</b>
        {" — "}
        {compact ? (
          <>
            המסכים מחשבים הכל בעצמם, כך שמה שמוצג כאן מעודכן. רק המייל, הפוש
            וה-WhatsApp לא יוצאים.{" "}
            <Link href="/notifications" className="font-medium text-brand-strong hover:underline">
              לכל ההתראות
            </Link>
          </>
        ) : (
          <>
            מייל, פוש ו-WhatsApp לא יוצאים כרגע. כל מה שדורש תשומת לב מחושב מחדש
            בכל כניסה ומופיע כאן ובלוח החובות, כך שאין פה משהו חסר — אבל עד
            שהשליחה תחזור, כדאי להיכנס ולא לחכות להתראה.
          </>
        )}
      </p>
    </div>
  );
}
