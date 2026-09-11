import { AlertOctagon, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { SWEEP_SCHEDULE, sweepSummary, type SweepHealth } from "@/lib/heartbeat";

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

export function SweepHealthPanel({ health }: { health: SweepHealth[] }) {
  const broken = health.filter(
    (h) => h.critical && (h.state === "stale" || h.state === "never")
  );

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      {broken.length > 0 && (
        <p className="mb-3 rounded-xl bg-status-overdue/10 p-3 text-sm leading-relaxed text-status-overdue">
          <b>
            {broken.length === 1
              ? "עבודה מתוזמנת קריטית לא רצה"
              : `${broken.length} עבודות מתוזמנות קריטיות לא רצות`}
          </b>
          {" — "}
          כל עוד זה המצב, לא נשלחות תזכורות במייל, בפוש או בוואטסאפ. המשתמשים
          עדיין רואים את מה שדחוף כשהם נכנסים לאפליקציה, אבל לא מקבלים פנייה
          יזומה. שווה לבדוק ש-CRON_SECRET מוגדר ושהתזמון פעיל בפלטפורמה.
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
              <p className="text-xs text-ink-muted">{sweepSummary(h)}</p>
            </div>
            <span className="tnum shrink-0 text-xs text-ink-faint">
              {/* The cadence it is judged against, so "late" is checkable. */}
              {SWEEP_SCHEDULE[h.job].everyHours >= 168
                ? "שבועי"
                : "יומי"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
