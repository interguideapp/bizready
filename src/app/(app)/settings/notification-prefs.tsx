"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateNotificationPrefs } from "@/lib/actions";
import { PushToggle } from "@/components/push-toggle";
import { Card } from "@/components/ui";

export function NotificationPrefs({
  notifyEmail,
  notifyWhatsapp,
  whatsappPhone,
  vapidPublicKey,
}: {
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  whatsappPhone: string | null;
  vapidPublicKey: string;
}) {
  const [email, setEmail] = useState(notifyEmail);
  const [whatsapp, setWhatsapp] = useState(notifyWhatsapp);
  const [phone, setPhone] = useState(whatsappPhone ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    email !== notifyEmail ||
    whatsapp !== notifyWhatsapp ||
    phone !== (whatsappPhone ?? "");

  function save() {
    startTransition(async () => {
      await updateNotificationPrefs({
        notify_email: email,
        notify_whatsapp: whatsapp,
        whatsapp_phone: phone.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-bold text-ink">תזכורות</h2>
      <p className="mb-4 text-sm text-ink-muted">
        נשלח לך סיכום כשמתקרב דדליין, משימה באיחור או משימה מחזורית חוזרת
      </p>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-edge-soft px-4 py-3">
        <span className="text-sm font-medium text-ink-soft">תזכורות במייל</span>
        <input
          type="checkbox"
          checked={email}
          onChange={(e) => setEmail(e.target.checked)}
          className="h-5 w-5 accent-brand-600"
        />
      </label>

      {vapidPublicKey && <PushToggle vapidPublicKey={vapidPublicKey} />}

      <label className="mt-2.5 flex cursor-pointer items-center justify-between rounded-xl border border-edge-soft px-4 py-3">
        <span className="text-sm font-medium text-ink-soft">תזכורות בוואטסאפ</span>
        <input
          type="checkbox"
          checked={whatsapp}
          onChange={(e) => setWhatsapp(e.target.checked)}
          className="h-5 w-5 accent-brand-600"
        />
      </label>

      {whatsapp && (
        <div className="mt-2.5">
          <label className="mb-1 block text-sm font-medium text-ink-soft">
            מספר וואטסאפ (כולל קידומת מדינה, למשל 972501234567)
          </label>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="972501234567"
            className="w-full rounded-xl border border-edge px-3 py-2.5 text-left text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            saved && <Check className="h-4 w-4" aria-hidden />
          )}
          {pending ? "שומר..." : saved ? "נשמר!" : "שמירת העדפות"}
        </button>
      </div>
    </Card>
  );
}
