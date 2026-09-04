import {
  Award,
  Banknote,
  CalendarClock,
  Download,
  FileText,
  IdCard,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { Card, Chip, FadeIn, PageTitle } from "@/components/ui";
import type { PassportData } from "@/lib/documents/passport";

/** The on-screen תיק העסק — a bento of official panels. Data-agnostic so it can
 *  be previewed with mock data. */
export function PassportView({ d }: { d: PassportData }) {
  return (
    <div className="pb-24 md:pb-8">
      <div className="mb-5 flex items-start justify-between gap-3">
        <PageTitle eyebrow="הפרופיל הרשמי" title="תיק העסק" subtitle="כל העסק במקום אחד — לבנק, לרו״ח, ולשקט הנפשי שלכם" />
        <a
          href="/api/passport/print"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-e-brand transition hover:from-brand-500 hover:to-brand-400"
        >
          <Download className="h-4 w-4" aria-hidden />
          הורדה כ-PDF
        </a>
      </div>

      <div className="flex flex-col gap-4">
        {/* readiness */}
        <FadeIn>
          <Card elevated className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -left-14 -top-14 h-48 w-48 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 70%)" }} />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="tnum flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-2xl font-bold text-white shadow-e-brand">
                {d.score}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">מצב מוכנות · רמה {d.levelNumber}</p>
                <p className="text-gradient text-xl font-extrabold">{d.levelTitle}</p>
                <p className="tnum mt-0.5 text-sm text-ink-muted">{d.completedCount}/{d.totalCount} משימות הושלמו</p>
              </div>
            </div>
            {d.badges.length > 0 && (
              <div className="relative mt-4 flex flex-wrap gap-2">
                {d.badges.map((b) => (
                  <Chip key={b} tone="brand" icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}>{b}</Chip>
                ))}
              </div>
            )}
          </Card>
        </FadeIn>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* identity */}
          {d.identity.length > 0 && (
            <PassportPanel icon={<IdCard className="h-4.5 w-4.5" aria-hidden />} title="פרטים ותיקים ברשויות">
              <dl className="grid gap-x-6 gap-y-2">
                {d.identity.map((i) => (
                  <div key={i.label} className="flex items-center justify-between gap-3 border-b border-edge-soft py-1.5">
                    <dt className="text-sm text-ink-muted">{i.label}</dt>
                    <dd dir="ltr" className="tnum text-sm font-semibold text-ink">{i.value}</dd>
                  </div>
                ))}
              </dl>
            </PassportPanel>
          )}

          {/* obligations */}
          {d.obligations.length > 0 && (
            <PassportPanel icon={<CalendarClock className="h-4.5 w-4.5" aria-hidden />} title="מועדי חובה קרובים">
              <div className="divide-y divide-edge-soft">
                {d.obligations.map((o, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink-soft">{o.title}{o.period && <span className="text-ink-faint"> · {o.period}</span>}</span>
                    <span className="tnum shrink-0 font-semibold text-ink">{o.date}</span>
                  </div>
                ))}
              </div>
            </PassportPanel>
          )}

          {/* documents */}
          {d.documents.length > 0 && (
            <PassportPanel icon={<FileText className="h-4.5 w-4.5" aria-hidden />} title={`מסמכים בארכיון (${d.documents.length})`}>
              <div className="divide-y divide-edge-soft">
                {d.documents.map((x, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink-soft">{x.name}</span>
                    <span className="tnum shrink-0 text-xs text-ink-muted">{x.date}{x.expires && ` · עד ${x.expires}`}</span>
                  </div>
                ))}
              </div>
            </PassportPanel>
          )}

          {/* costs */}
          {d.costs.length > 0 && (
            <PassportPanel icon={<Banknote className="h-4.5 w-4.5" aria-hidden />} title="עלויות קבועות">
              <div className="divide-y divide-edge-soft">
                {d.costs.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink-soft">{c.name}<span className="text-ink-faint"> · {c.cadence}</span></span>
                    <span className="tnum shrink-0 font-semibold text-ink">{c.amount}</span>
                  </div>
                ))}
              </div>
              {d.monthlyCost && (
                <p className="tnum mt-3 border-t border-edge pt-3 text-sm text-ink-soft">סה״כ חודשי: <b className="text-ink">{d.monthlyCost}</b> · שנתי: <b className="text-ink">{d.annualCost}</b></p>
              )}
            </PassportPanel>
          )}

          {/* price list */}
          {d.products.length > 0 && (
            <PassportPanel icon={<ShoppingBag className="h-4.5 w-4.5" aria-hidden />} title="מחירון">
              <div className="divide-y divide-edge-soft">
                {d.products.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink-soft">{p.name}</span>
                    <span className="tnum shrink-0 font-semibold text-ink">{p.price}</span>
                  </div>
                ))}
              </div>
            </PassportPanel>
          )}
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
        <Award className="h-3.5 w-3.5" aria-hidden />
        התיק מתעדכן אוטומטית מכל מה שמילאתם במערכת. ה-PDF מתאים לשליחה לבנק או לרו״ח.
      </p>
    </div>
  );
}

function PassportPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <FadeIn>
      <Card className="h-full p-5">
        <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
          <span className="text-brand-400">{icon}</span>
          {title}
        </h2>
        {children}
      </Card>
    </FadeIn>
  );
}
