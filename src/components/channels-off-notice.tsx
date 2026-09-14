import Link from "next/link";
import { BellOff } from "lucide-react";

/**
 * The user's own channels are off — said once, the same way, everywhere.
 *
 * Not an alarm, and deliberately not DeliveryNotice. Nothing is broken: they
 * switched email, push and WhatsApp off, or never had a phone number or a
 * subscribed browser, and a red outage bar about a setting they chose is how a
 * product teaches people to dismiss its warnings.
 *
 * But silence is not the alternative. Someone who turned email off months ago
 * and has been relying on a reminder since has no way to learn that no reminder
 * is coming — and this product's entire claim is that nothing gets missed.
 * One line, and the switch one tap away.
 *
 * SHARED because I first wrote it inline on the obligations board, which is the
 * mistake this codebase keeps paying for: one fact, three surfaces, and the
 * two that were not updated go on implying something else. /notifications in
 * particular was showing SweepNotice instead, whose copy ends "כדאי להיכנס
 * לכאן מדי פעם עד שנוודא שהשליחה האוטומטית עובדת" — sending works fine; it is
 * switched off. Telling someone we need to verify our own machinery, when the
 * cause is their preference, sends them to wait for a fix that will never come.
 */
export function ChannelsOffNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-edge-soft bg-surface-2/60 px-4 py-2.5 text-sm text-ink-soft">
      <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
      <span>
        <b className="text-ink">התזכורות החוצה כבויות</b>
        {" — "}
        {compact
          ? "מה שמוצג כאן מעודכן בכל כניסה, אבל לא תגיע הודעה לפני מועד."
          : "כל מה שדורש תשומת לב מחושב מחדש בכל כניסה ומופיע כאן ובלוח החובות, אבל לא תגיע אליכם הודעה לפני מועד."}{" "}
        <Link href="/settings" className="font-medium text-brand-strong hover:underline">
          להפעיל תזכורות
        </Link>
      </span>
    </div>
  );
}
