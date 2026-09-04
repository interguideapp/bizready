import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Command, Handshake, Target, TrendingUp } from "lucide-react";
import { PartnerForm } from "@/components/partners/partner-form";

export const metadata: Metadata = {
  title: "פרסום ב-BizReady — הצטרפות שותפים",
  description: "הגיעו לבעלי עסקים חדשים בישראל בדיוק ברגע שהם צריכים את השירות שלכם.",
};

const POINTS = [
  { icon: Target, title: "לקוחות ברגע הנכון", text: "העסק שלכם מופיע בדיוק במשימה שבה בעל עסק חדש צריך את השירות — רו״ח, ביטוח, סליקה, אתר ועוד." },
  { icon: TrendingUp, title: "לידים חמים, לא חשיפה סתם", text: "לא באנרים. אנשים שכבר בתהליך הקמה ומחפשים בדיוק את מה שאתם נותנים." },
  { icon: BadgeCheck, title: "שקוף ואמין", text: "כל הצעה מסומנת בבירור כ״מקודם / הצעת שותף״ — אמון הוא הנכס, גם שלכם וגם שלנו." },
];

export default function PartnersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-to text-white shadow-e-brand">
            <Command className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-xl font-bold text-gradient">BizReady</span>
        </Link>
        <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
          כניסה
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <section className="pt-10 text-center">
          <p className="eyebrow mb-2 inline-flex items-center gap-1.5 justify-center">
            <Handshake className="h-3.5 w-3.5" aria-hidden /> שותפים
          </p>
          <h1 className="text-display text-ink">פרסמו את העסק שלכם מול עסקים חדשים</h1>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-ink-soft">
            כל יום נפתחים בישראל עסקים חדשים שצריכים רו״ח, ביטוח, סליקה, אתר ועוד. ב-BizReady אתם מופיעים
            בדיוק במשימה הרלוונטית — רישום חינם, ותשלום רק על מה שעובד.
          </p>
        </section>

        {/* value points */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="panel rounded-card p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand-strong">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-bold text-ink">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{p.text}</p>
            </div>
          ))}
        </section>

        {/* pricing tiers */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="panel rounded-card p-5">
            <p className="eyebrow">התחלה</p>
            <p className="mt-1 text-title text-ink">רישום חינם</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
              <li>• הופעה במשימה הרלוונטית</li>
              <li>• קישור וקוד קופון עם מעקב</li>
              <li>• אתם משלמים רק עמלה על המרה</li>
            </ul>
          </div>
          <div className="panel rounded-card p-5 ring-1 ring-brand-edge/50">
            <p className="eyebrow text-brand-strong">מודגש</p>
            <p className="mt-1 text-title text-ink">מיקום בולט</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
              <li>• מופיעים ראשונים + תג Verified</li>
              <li>• עיצוב בולט וסטטיסטיקות מלאות</li>
              <li>• מנוי חודשי קבוע + עמלה</li>
            </ul>
          </div>
        </section>

        {/* form */}
        <section className="mx-auto mt-10 max-w-2xl">
          <h2 className="mb-4 text-center text-section text-ink">בקשת הצטרפות</h2>
          <PartnerForm />
        </section>
      </main>
    </div>
  );
}
