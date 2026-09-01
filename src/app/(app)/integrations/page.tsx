import {
  BadgeCheck,
  Banknote,
  Eye,
  Landmark,
  Lock,
  Receipt,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { UpgradeCta } from "@/components/upgrade-cta";
import { Card, PageTitle } from "@/components/ui";
import { getBusiness } from "@/lib/data";
import { isPro } from "@/lib/subscription";

/**
 * Focused, honest integrations screen. We connect only the two data sources that
 * actually change the picture — invoicing (revenue → ceiling, documents) and,
 * later, the bank via official Open Banking — read-only and consent-based. We
 * never ask for a bank password and never scrape. Everything here is Pro.
 */
export default async function IntegrationsPage() {
  const business = (await getBusiness())!;
  const pro = isPro(business);

  return (
    <div>
      <PageTitle
        title="חיבורים"
        subtitle="מחברים רק את מה שבאמת עוזר — קריאה בלבד, בהסכמה, בלי סיסמאות"
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-brand-edge bg-brand-tint/40 p-4 text-sm leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
        <p>
          בחרנו <b className="text-ink">לא</b> להתחבר לעשרות מערכות סתם. חיבור שווה
          משהו רק אם הוא מביא נתון שמזיז החלטה — ולכן יש כאן בדיוק שניים, שניהם{" "}
          <b className="text-ink">קריאה בלבד</b> ומאובטחים.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <IntegrationCard
          icon={<Receipt className="h-5 w-5" aria-hidden />}
          title="תוכנת חשבוניות"
          providers="Green Invoice · חשבונית ירוקה · iCount · Morning"
          status="בקרוב ל-Pro"
          available
          points={[
            "מחזור אמיתי → מד תקרת עוסק פטור מתעדכן לבד",
            "אימות אוטומטי שמשימת החשבוניות באמת מסודרת",
            "מספרי הקצאה ומסמכים — נכנסים לארכיון בלי הקלדה",
          ]}
          security="חיבור בטוקן API של הספק (לא סיסמה), הרשאת קריאה בלבד."
        />

        <IntegrationCard
          icon={<Banknote className="h-5 w-5" aria-hidden />}
          title="חשבון בנק — דרך Open Banking רשמי"
          providers="בנקאות פתוחה מפוקחת (בהסכמתכם)"
          status="בפיתוח"
          available={false}
          points={[
            "תזרים אמיתי — כמה נכנס וכמה יצא, בלי אקסלים",
            "אימות שהפרשתם כסף למס וביטוח לאומי",
            "זיהוי פערים בין תשלומים לחשבוניות",
          ]}
          security="דרך מסלקה/אגרגטור מורשה בלבד, בהסכמה מפורשת, קריאה בלבד — לעולם לא נבקש את סיסמת הבנק."
        />
      </div>

      {/* the safety contract */}
      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">איך אנחנו שומרים שזה בטוח</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <SafetyRow
            icon={<Eye className="h-4 w-4" aria-hidden />}
            text="קריאה בלבד — אף חיבור לא יכול להזיז כסף או לשנות נתונים"
          />
          <SafetyRow
            icon={<Lock className="h-4 w-4" aria-hidden />}
            text="טוקנים מאובטחים, לא סיסמאות — ובוודאי לא סיסמת בנק"
          />
          <SafetyRow
            icon={<Unplug className="h-4 w-4" aria-hidden />}
            text="אפשר לנתק כל חיבור בלחיצה, בכל רגע"
          />
          <SafetyRow
            icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
            text="שקוף — תמיד רואים מה נמשך, מתי, ולמה"
          />
        </div>
      </section>

      {!pro && (
        <div className="mt-6">
          <UpgradeCta />
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        חיבורים הם חלק מ-BizReady Pro. עד שהחיבור החי נפתח, אפשר להזין את הנתונים
        ידנית — והמערכת עובדת בדיוק אותו דבר.
      </p>
    </div>
  );
}

function IntegrationCard({
  icon,
  title,
  providers,
  status,
  available,
  points,
  security,
}: {
  icon: React.ReactNode;
  title: string;
  providers: string;
  status: string;
  available: boolean;
  points: string[];
  security: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-ink">{title}</h3>
            <p className="text-xs text-ink-muted">{providers}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            available
              ? "bg-status-progress-bg text-status-progress"
              : "bg-surface-2 text-ink-muted"
          }`}
        >
          {status}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-ink-soft">
            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-ink-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {security}
      </p>
    </Card>
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
