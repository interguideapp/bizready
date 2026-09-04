"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitPartnerApplication } from "@/lib/actions";

const SERVICE_TYPES = [
  "רו״ח / יועץ מס",
  "סוכן ביטוח",
  "סוכן פנסיוני / בית השקעות",
  "חברת סליקה",
  "בנק / פינטק עסקי",
  "תוכנה (חשבוניות / שכר / CRM)",
  "עורך דין / מסמכים משפטיים",
  "בונה אתרים / דיגיטל",
  "שיווק / מיתוג / עיצוב",
  "חברת הנגשה",
  "דומיין / אחסון / אימייל",
  "יועץ רישוי עסקים",
  "שילוח ולוגיסטיקה",
  "הדרכות והסמכות",
  "ייעוץ עסקי / פיננסי",
  "אחר",
];

const field =
  "w-full rounded-xl border border-edge bg-card px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge";

export function PartnerForm() {
  const [tier, setTier] = useState<"free" | "featured">("free");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitPartnerApplication({
        businessName: String(f.get("businessName") ?? ""),
        contactName: String(f.get("contactName") ?? ""),
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
        serviceType: String(f.get("serviceType") ?? ""),
        tier,
        website: String(f.get("website") ?? ""),
        message: String(f.get("message") ?? ""),
      });
      if (res.ok) setDone(true);
      else setError(res.error ?? "השליחה נכשלה.");
    });
  }

  if (done) {
    return (
      <div className="panel rounded-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-done-bg text-status-done">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="text-title text-ink">הבקשה נשלחה 🎉</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          נעבור עליה ונחזור אליכם במייל. תודה שאתם רוצים לעזור לעסקים חדשים בישראל.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel rounded-card p-6">
      {/* tier picker */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {(["free", "featured"] as const).map((t) => {
          const active = tier === t;
          return (
            <button
              type="button"
              key={t}
              onClick={() => setTier(t)}
              className={`rounded-xl border p-3 text-right transition ${
                active ? "border-brand-600 bg-brand-tint ring-2 ring-brand-edge" : "border-edge bg-card hover:border-edge-strong"
              }`}
            >
              <span className={`block text-sm font-bold ${active ? "text-brand-strong" : "text-ink"}`}>
                {t === "free" ? "רישום חינם" : "מודגש (בתשלום)"}
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-muted">
                {t === "free" ? "עמלה רק על המרה" : "מיקום בולט + תג Verified"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">שם העסק *</span>
          <input name="businessName" required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">איש קשר *</span>
          <input name="contactName" required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">אימייל *</span>
          <input name="email" type="email" required dir="ltr" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">טלפון</span>
          <input name="phone" dir="ltr" className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-muted">תחום השירות *</span>
          <select name="serviceType" required defaultValue="" className={field}>
            <option value="" disabled>בחרו תחום…</option>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-muted">אתר / קישור</span>
          <input name="website" dir="ltr" placeholder="https://" className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-muted">כמה מילים על מה שאתם מציעים</span>
          <textarea name="message" rows={3} className={field} />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-status-overdue">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 px-6 py-3 font-semibold text-white shadow-e-brand transition hover:opacity-95 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        שליחת הבקשה
      </button>
      <p className="mt-3 text-center text-[11px] text-ink-faint">
        אין התחייבות. נחזור אליכם לפני שמפרסמים משהו.
      </p>
    </form>
  );
}
