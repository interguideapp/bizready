import { BadgeCheck, Eye, Lock, ShieldCheck, Unplug } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { IntegrationsManager, type ProviderInfo } from "@/components/integrations/manager";
import { requireBusiness, getConnections, getOpenSyncErrors } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { allSweepHealth, jobIsDown, type SweepJob } from "@/lib/heartbeat";
import { lapsedLabel } from "@/lib/he-distance";
import { ErrorsList } from "./errors-list";
import { PROVIDERS } from "@/lib/integrations/registry";

/**
 * Focused, honest integrations screen. We activate the invoicing sources first
 * (where the regulatory value lives) — read-only, consent-based, no bank
 * passwords. Manual "סנכרן עכשיו" works today, and the page now READS the
 * heartbeat to say whether the nightly sync is running rather than hedging
 * about a key the reader cannot check.
 */
export default async function IntegrationsPage() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const [connections, syncErrors, sweeps] = await Promise.all([
    getConnections(business.id),
    // getOpenSyncErrors had no caller: the query existed, the row type existed,
    // and ErrorsList existed — 63 lines of finished UI that nothing imported.
    // So when a sync failed, the pipeline recorded the reason and the user was
    // never shown it. This is where those errors belong: next to the connection
    // that produced them.
    getOpenSyncErrors(business.id),
    supabase.rpc("sweep_health"),
  ]);

  /*
   * Whether the nightly sync is ACTUALLY running, rather than a hedge about it.
   *
   * This line used to read "הסנכרון האוטומטי הלילי פועל ברקע כשמוגדר מפתח
   * השירות" — a condition the reader has no way to evaluate, which is the same
   * non-answer the admin panel used to give about CRON_SECRET. The page can
   * simply look: the heartbeat records every job's last success.
   *
   * It matters more here than the wording suggests. Unlike reminders, sync has
   * NO fallback — the lazy sweep deliberately runs reminders only — so when the
   * schedule is dead, revenue is whatever was last pulled by hand. Revenue
   * feeds the עוסק פטור ceiling, so someone who believes the figures refresh
   * nightly is trusting a percentage that may be months stale.
   */
  const syncHealth = allSweepHealth(
    ((sweeps.data ?? []) as {
      job: string;
      last_ok_at: string | null;
      last_failed_at: string | null;
    }[]).map((r) => ({
      job: r.job as SweepJob,
      lastOkAt: r.last_ok_at,
      lastFailedAt: r.last_failed_at,
    })),
    new Date().toISOString()
  ).find((h) => h.job === "sync");
  const autoSyncRunning = Boolean(syncHealth) && !jobIsDown(syncHealth);

  // invoicing-first: expose only the invoicing providers as serializable info
  const providers: ProviderInfo[] = PROVIDERS.filter((p) => p.category === "invoicing").map((p) => ({
    id: p.id,
    label: p.label,
    mode: p.mode,
    setupGuide: p.setupGuide,
    authFields: p.authFields.map((a) => ({ key: a.key, label: a.label, type: a.type, placeholder: a.placeholder })),
    pullableFields: p.pullableFields.map((f) => ({ key: f.key, label: f.label, default: f.default })),
  }));

  return (
    <div>
      <PageTitle
        eyebrow="נתונים חיים"
        title="חיבורים"
        subtitle="מחברים רק את מה שבאמת עוזר — קריאה בלבד, בהסכמה, והפרטים מוצפנים"
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-brand-edge bg-brand-tint/40 p-4 text-sm leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
        <p>
          מתחילים מ<b className="text-ink">תוכנת החשבוניות</b> — משם מגיע הנתון שמזיז החלטה: מחזור אמיתי
          למד תקרת עוסק פטור, אימות מספרי הקצאה, וזיהוי חוסרים. הכול <b className="text-ink">קריאה בלבד</b>,
          והפרטים נשמרים מוצפנים. חלק מהספקים עדיין דורשים שם משתמש וסיסמה ולא טוקן —
          במקרה כזה נגיד לכם את זה מראש, במסך החיבור.
        </p>
      </div>

      {syncErrors.length > 0 && (
        <div className="mb-5">
          <ErrorsList errors={syncErrors} />
        </div>
      )}

      <IntegrationsManager providers={providers} connections={connections} />

      {/* the safety contract */}
      <section className="mt-8">
        <h2 className="mb-3 font-bold text-ink">איך אנחנו שומרים שזה בטוח</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <SafetyRow icon={<Eye className="h-4 w-4" aria-hidden />} text="קריאה בלבד — אף חיבור לא יכול להזיז כסף או לשנות נתונים" />
          <SafetyRow icon={<Lock className="h-4 w-4" aria-hidden />} text="המפתחות נשמרים מוצפנים (AES-256) ולעולם לא נחשפים בדפדפן. לא מבקשים סיסמת בנק." />
          <SafetyRow icon={<Unplug className="h-4 w-4" aria-hidden />} text="אפשר לנתק כל חיבור בלחיצה, בכל רגע" />
          <SafetyRow icon={<BadgeCheck className="h-4 w-4" aria-hidden />} text="שקוף — תמיד רואים מה נמשך, מתי, ולמה" />
        </div>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        אין חיבור? אפשר להזין נתונים ידנית — המערכת עובדת בדיוק אותו דבר.{" "}
        {autoSyncRunning ? (
          <>
            הסנכרון הלילי פועל ברקע
            {syncHealth?.hoursSince != null && syncHealth.hoursSince > 0
              ? ` — רץ בהצלחה לפני ${syncHealth.hoursSince} שעות.`
              : "."}
          </>
        ) : (
          <>
            <b className="text-ink">הסנכרון הלילי אינו פעיל כרגע</b>
            {syncHealth?.hoursSince != null
              ? ` (${lapsedLabel(Math.floor(syncHealth.hoursSince / 24))})`
              : " — הוא לא רץ עדיין אף פעם"}
            , ולכן המחזור מתעדכן רק כשמריצים ״סנכרן עכשיו״. שימו לב שבדיקת תקרת
            עוסק פטור מסתמכת על המחזור הזה.
          </>
        )}
      </p>
    </div>
  );
}

function SafetyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-edge-soft bg-card px-3.5 py-3 text-sm text-ink-soft">
      <span className="shrink-0 text-brand-strong">{icon}</span>
      {text}
    </div>
  );
}
