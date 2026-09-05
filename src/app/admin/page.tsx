import Link from "next/link";
import { redirect } from "next/navigation";
import { Command, Inbox, PhoneCall } from "lucide-react";
import { CATEGORIES, TASK_TEMPLATES } from "@/lib/content";
import { getAllOffers, getPartnerApplications, getPartnerLeads, isAdmin } from "@/lib/data";
import { ApplicationRow } from "@/components/admin/application-row";
import { OfferManager } from "@/components/admin/offer-manager";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const [applications, offers, leads] = await Promise.all([
    getPartnerApplications(),
    getAllOffers(),
    getPartnerLeads(),
  ]);
  const pending = applications.filter((a) => a.status === "new").length;
  const templateIds = TASK_TEMPLATES.map((t) => t.id);
  const categoryIds = CATEGORIES.map((c) => c.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-to text-white shadow-e-brand">
            <Command className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <p className="eyebrow">ניהול מרקטפלייס</p>
            <h1 className="text-title text-ink">אדמין</h1>
          </div>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-brand-strong hover:opacity-80">לאפליקציה ←</Link>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
          <Inbox className="h-4.5 w-4.5 text-brand-400" aria-hidden />
          בקשות הצטרפות
          {pending > 0 && <span className="tnum rounded-full bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand-strong">{pending} חדשות</span>}
        </h2>
        {applications.length === 0 ? (
          <p className="text-sm text-ink-muted">אין עדיין בקשות. שתפו את הקישור <span dir="ltr">/partners</span>.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {applications.map((a) => <ApplicationRow key={a.id} app={a} />)}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
          <PhoneCall className="h-4.5 w-4.5 text-brand-400" aria-hidden />
          לידים מהאפליקציה
          {leads.length > 0 && <span className="tnum rounded-full bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand-strong">{leads.length}</span>}
        </h2>
        {leads.length === 0 ? (
          <p className="text-sm text-ink-muted">אין עדיין לידים. כל "שיחזרו אליי" בהצעת שותף יופיע כאן — הבסיס לחיוב.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {leads.map((l) => (
              <div key={l.id} className="panel flex items-start justify-between gap-3 rounded-card p-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{l.partner_hint ?? "הצעת שותף"}</p>
                  <p className="text-sm text-ink-soft">{l.contact_name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-muted" dir="ltr">
                    {[l.contact_email, l.contact_phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs text-ink-faint">
                  {new Date(l.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <OfferManager offers={offers} templateIds={templateIds} categoryIds={categoryIds} />
      </section>
    </div>
  );
}
