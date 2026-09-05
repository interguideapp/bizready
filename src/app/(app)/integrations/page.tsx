import { BadgeCheck, Eye, Lock, ShieldCheck, Unplug } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { IntegrationsManager, type ProviderInfo } from "@/components/integrations/manager";
import { getBusiness, getConnections } from "@/lib/data";
import { PROVIDERS } from "@/lib/integrations/registry";

/**
 * Focused, honest integrations screen. We activate the invoicing sources first
 * (where the regulatory value lives) — read-only, consent-based, no bank
 * passwords. Manual "סנכרן עכשיו" works today; the nightly auto-sync + webhooks
 * run in the background once the service-role key is set.
 */
export default async function IntegrationsPage() {
  const business = (await getBusiness())!;
  const connections = await getConnections(business.id);

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
        subtitle="מחברים רק את מה שבאמת עוזר — קריאה בלבד, בהסכמה, בלי סיסמאות"
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-brand-edge bg-brand-tint/40 p-4 text-sm leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
        <p>
          מתחילים מ<b className="text-ink">תוכנת החשבוניות</b> — משם מגיע הנתון שמזיז החלטה: מחזור אמיתי
          למד תקרת עוסק פטור, אימות מספרי הקצאה, וזיהוי חוסרים. הכול <b className="text-ink">קריאה בלבד</b>.
        </p>
      </div>

      <IntegrationsManager providers={providers} connections={connections} />

      {/* the safety contract */}
      <section className="mt-8">
        <h2 className="mb-3 font-bold text-ink">איך אנחנו שומרים שזה בטוח</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <SafetyRow icon={<Eye className="h-4 w-4" aria-hidden />} text="קריאה בלבד — אף חיבור לא יכול להזיז כסף או לשנות נתונים" />
          <SafetyRow icon={<Lock className="h-4 w-4" aria-hidden />} text="טוקנים מאובטחים, לא סיסמאות — ובוודאי לא סיסמת בנק" />
          <SafetyRow icon={<Unplug className="h-4 w-4" aria-hidden />} text="אפשר לנתק כל חיבור בלחיצה, בכל רגע" />
          <SafetyRow icon={<BadgeCheck className="h-4 w-4" aria-hidden />} text="שקוף — תמיד רואים מה נמשך, מתי, ולמה" />
        </div>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        אין חיבור? אפשר להזין נתונים ידנית — המערכת עובדת בדיוק אותו דבר. הסנכרון האוטומטי הלילי פועל
        ברקע כשמוגדר מפתח השירות.
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
