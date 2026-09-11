import { Radio } from "lucide-react";

/**
 * Says plainly that something on this page was never sent anywhere.
 *
 * The list merges two sources: rows the nightly sweep wrote, and items derived
 * live on page load. The derived ones are true — that is the point of deriving
 * them — but no email, push or WhatsApp went out for them, because sending is
 * the sweep's job.
 *
 * Without this line the page would imply the user had already been contacted,
 * which is the quiet half of the same problem: not a wrong fact on screen, but
 * a wrong assumption about what happened off it. Someone relying on reminders
 * needs to know when the reminders are not arriving.
 */
export function SweepNotice({ count }: { count: number }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-status-progress/30 bg-status-progress-bg/40 p-3.5">
      <Radio className="mt-0.5 h-4 w-4 shrink-0 text-status-progress" aria-hidden />
      <p className="text-sm leading-relaxed text-ink-soft">
        <b className="text-ink">
          {count === 1 ? "פריט אחד כאן חדש" : `${count} פריטים כאן חדשים`}
        </b>{" "}
        — זיהינו אותם ברגע שנכנסתם, ולא נשלחה עליהם התראה במייל או בפוש. אם אתם
        מסתמכים על ההתראות שמגיעות אליכם, כדאי להיכנס לכאן מדי פעם עד שנוודא
        שהשליחה האוטומטית עובדת.
      </p>
    </div>
  );
}
