import { AlertOctagon, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { SWEEP_SCHEDULE, sweepDetail, type SweepHealth } from "@/lib/heartbeat";
import { anyOutboundChannel, type OutboundChannels } from "@/lib/notify/configured";
import { RunJobButton } from "@/components/admin/run-job-button";

/**
 * Whether the scheduled work is actually running.
 *
 * This panel exists because nothing recorded it. The reminder sweep sends every
 * email, push and WhatsApp the product promises, and a single missing
 * environment variable disables it silently — the routes fail closed on purpose,
 * which is right, but the failure mode was invisible.
 *
 * Shown to admins rather than to users: the user-facing surfaces were made
 * independent of the sweep instead (the notifications page derives what is due
 * on load), so what a user needs is for it to work, and what an operator needs
 * is to find out when it does not.
 */
const ICON = {
  ok: <CheckCircle2 className="h-4 w-4 text-status-done" aria-hidden />,
  late: <Clock className="h-4 w-4 text-status-progress" aria-hidden />,
  stale: <AlertOctagon className="h-4 w-4 text-status-overdue" aria-hidden />,
  never: <HelpCircle className="h-4 w-4 text-status-overdue" aria-hidden />,
} as const;

export function SweepHealthPanel({
  health,
  secretConfigured,
  channels,
  pushDevices,
}: {
  health: SweepHealth[];
  /** Whether CRON_SECRET exists. The value is never sent here. */
  secretConfigured: boolean;
  /**
   * How many browsers are subscribed to push, across all tenants.
   *
   * A count, not a list: it answers "can push reach anyone at all" without
   * naming a business or an endpoint.
   */
  pushDevices: number;
  /**
   * Which outbound channels are configured. Presence only, never a key.
   *
   * Delivery needs TWO things and this panel reported one. An operator could
   * set CRON_SECRET, watch the runs below start accumulating, and still send
   * zero messages with nothing here explaining it — which is what the live
   * database showed: a successful sweep, thirteen in-app notifications, and
   * reminder_log completely empty.
   */
  channels: OutboundChannels;
}) {
  const broken = health.filter(
    (h) => h.critical && (h.state === "stale" || h.state === "never")
  );
  const canSend = anyOutboundChannel(channels);

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      {/* THE ONE PIECE OF CONFIGURATION, STATED.
          An empty heartbeat has two completely different causes — the schedule
          was never registered, or it fired and was rejected for a missing
          secret — and this page could not tell them apart. It said "שווה לבדוק
          ש-CRON_SECRET מוגדר", which is advice, not an answer. Now it answers. */}
      {!secretConfigured && (
        <p className="mb-3 rounded-xl bg-status-overdue/10 p-3 text-sm leading-relaxed text-status-overdue">
          <b>CRON_SECRET לא מוגדר בסביבה הזו</b>
          {" — "}
          כל קריאה ל-/api/cron/* נדחית ב-401, ולכן שום תזכורת לא תישלח גם אם
          התזמון פעיל. Vercel שולח את כותרת ההרשאה רק כשהמשתנה קיים. אחרי
          שמגדירים אותו ב-Project → Settings → Environment Variables ומפרסמים
          מחדש, השורה הזו תיעלם והעבודות למטה יתחילו להצטבר.
        </p>
      )}
      {/* THE SECOND PIECE OF CONFIGURATION.
          A schedule that fires has nowhere to send without a provider, and
          sendEmailDigest returns "email not configured" before it attempts
          anything — so reminder_log stays EMPTY rather than filling with
          failures, which is the hardest possible shape to notice. Naming the
          exact variables makes it one step instead of a hunt. */}
      {!canSend && (
        <p className="mb-3 rounded-xl bg-status-overdue/10 p-3 text-sm leading-relaxed text-status-overdue">
          <b>אין ערוץ שליחה מוגדר</b>
          {" — "}
          גם כשהסריקה רצה בהצלחה, לא יוצאת שום הודעה: היא מסתיימת לפני הניסיון
          ולכן <span dir="ltr">reminder_log</span> נשאר ריק ולא נרשם כישלון.
          למייל דרושים <span dir="ltr">RESEND_API_KEY</span> ו
          <span dir="ltr">REMINDER_FROM_EMAIL</span>; לפוש{" "}
          <span dir="ltr">VAPID_PUBLIC_KEY</span>,{" "}
          <span dir="ltr">VAPID_PRIVATE_KEY</span> ו
          <span dir="ltr">VAPID_SUBJECT</span> לשליחה, ובנוסף{" "}
          <span dir="ltr">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span> — בלעדיו כפתור
          ההרשמה לפוש לא מוצג בכלל ולכן אף דפדפן לא יירשם. עד אז ההתראות קיימות
          באפליקציה בלבד, והמשתמשים רואים על כך הודעה מפורשת.
        </p>
      )}
      {canSend && (
        <p className="mb-3 text-xs text-ink-muted">
          ערוצים מוגדרים:{" "}
          {[channels.email && "מייל", channels.whatsapp && "וואטסאפ", channels.push && "פוש"]
            .filter(Boolean)
            .join(" · ")}
          {" · "}
          <span>
            דפדפנים רשומים לפוש: <b>{pushDevices}</b>
          </span>
        </p>
      )}
      {/* CONFIGURED IS NOT REACHABLE, and this is where an operator can see
          the difference. Keys with no subscribed device send nothing, and the
          count is the only thing that says so — measured live at zero on both
          businesses while the keys were the recommended next step. */}
      {channels.push && pushDevices === 0 && (
        <p className="mb-3 rounded-xl bg-status-progress-bg/40 p-3 text-sm leading-relaxed text-ink-soft">
          <b>הפוש מוגדר אבל אין לו יעד</b>
          {" — "}
          אף דפדפן לא נרשם, ולכן לא תישלח שום התראת פוש. אם{" "}
          <span dir="ltr">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span> חסר, כפתור ההרשמה
          לא מוצג למשתמשים ואי אפשר להירשם. שימו לב שערוץ מוגדר ללא נמענים אינו
          נחשב שליחה בפועל באף מסך משתמש.
        </p>
      )}
      {secretConfigured && broken.length > 0 && (
        <p className="mb-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-muted">
          CRON_SECRET מוגדר, כך שדחייה על אימות אינה ההסבר. אם למטה אין ריצות
          בכלל, התזמון עצמו לא נרשם — ב-Hobby מותרות שתי עבודות cron לכל
          פרויקט, ו-vercel.json צריך להישאר עם רשומה אחת.
        </p>
      )}
      {secretConfigured && broken.length > 0 && (
        <p className="mb-3 rounded-xl bg-status-overdue/10 p-3 text-sm leading-relaxed text-status-overdue">
          <b>
            {broken.length === 1
              ? "עבודה מתוזמנת קריטית לא רצה"
              : `${broken.length} עבודות מתוזמנות קריטיות לא רצות`}
          </b>
          {" — "}
          כל עוד זה המצב, לא נשלחות תזכורות במייל, בפוש או בוואטסאפ. המשתמשים
          עדיין רואים את מה שדחוף כשהם נכנסים לאפליקציה, אבל לא מקבלים פנייה
          יזומה.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-edge-soft">
        {health.map((h) => (
          <li key={h.job} className="flex items-center gap-2.5 py-2.5">
            <span className="shrink-0">{ICON[h.state]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {h.label}
                {h.critical && (
                  <span className="ms-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-ink-muted">
                    קריטי
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-muted">{sweepDetail(h)}</p>
            </div>
            <span className="tnum shrink-0 text-xs text-ink-faint">
              {/* The cadence it is judged against, so "late" is checkable. */}
              {SWEEP_SCHEDULE[h.job].everyHours >= 168
                ? "שבועי"
                : "יומי"}
            </span>
            {/* Runnable by hand, because with CRON_SECRET unset it was not
                runnable at all — by anyone, including the owner. */}
            <RunJobButton job={h.job} label={h.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}
