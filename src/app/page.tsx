import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FolderOpen,
  Gauge,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Disclaimer } from "@/components/ui";

const FEATURES = [
  {
    icon: Sparkles,
    title: "תכנית אישית ב-5 דקות",
    text: "עונים על שאלון קצר על העסק — ומקבלים את כל מה שצריך לעשות, מותאם בדיוק אליכם",
  },
  {
    icon: ListChecks,
    title: "כל החובות שלא ידעתם עליהן",
    text: "פנסיה חובה, חשבוניות ישראל, נגישות, פרטיות — אנחנו עוקבים אחרי הרגולציה בשבילכם",
  },
  {
    icon: Gauge,
    title: "ציון מוכנות חי",
    text: "רואים בדיוק איפה העסק עומד, מה הושלם ומה הצעד הבא — הציון עולה עם כל משימה",
  },
  {
    icon: FolderOpen,
    title: "הכל מתויק במקום אחד",
    text: "תעודות, פוליסות, מספרי תיקים ופרטי בנק — זמינים בשנייה כשהבנק או הרו\"ח מבקשים",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold text-brand-700">BizReady</span>
        <Link
          href="/login"
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          כניסה
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            פותחים עסק בישראל?
            <br />
            <span className="text-brand-600">אנחנו נדאג שלא תפספסו כלום.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            רישום ברשויות, מיסים, ביטוחים, נוכחות דיגיטלית — כל מה שעסק חדש
            צריך, בתכנית אחת ברורה עם סטטוסים, תזכורות וציון מוכנות.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
          >
            בנו לי תכנית לעסק — חינם
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <p className="mt-3 text-sm text-slate-400">
            5 דקות, בלי כרטיס אשראי
          </p>
        </section>

        <section className="mx-auto grid max-w-4xl gap-4 px-6 pb-16 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-slate-100 bg-slate-50/60 py-12">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              מתאים לעוסק פטור ולעוסק מורשה
            </h2>
            <ul className="mx-auto mt-5 flex max-w-md flex-col gap-2 text-right">
              {[
                "כל משימה עם הסבר, צעדים וקישורים רשמיים",
                "דדליינים ומשימות מחזוריות — כלום לא נופל",
                "מבוסס על מקורות רשמיים ומתעדכן כשהחוק משתנה",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-slate-700">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-status-done"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
