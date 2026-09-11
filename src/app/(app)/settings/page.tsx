import Link from "next/link";
import { Command } from "lucide-react";
import { UpgradeCta } from "@/components/upgrade-cta";
import { PageTitle } from "@/components/ui";
import { isAdmin, requireBusiness } from "@/lib/data";
import { isPro } from "@/lib/subscription";
import type { OnboardingAnswers } from "@/lib/types";
import { NotificationPrefs } from "./notification-prefs";
import { SettingsForm } from "./settings-form";
import { SubscriptionBlock } from "./subscription-block";

export default async function SettingsPage() {
  const business = await requireBusiness();
  // /admin had zero inbound links anywhere — a full marketplace and
  // content-review console reachable only by typing the URL. This is its
  // entry point, and it renders for nobody else.
  const admin = await isAdmin();
  return (
    <div>
      <PageTitle
        title="הגדרות וכיול התכנית"
        subtitle="השתנה משהו בעסק? עדכנו את הפרטים וראו בדיוק איך התכנית מתכיילת — לפני שמאשרים"
      />
      <div className="mb-5">
        {isPro(business) ? (
          <SubscriptionBlock until={business.subscription_until} />
        ) : (
          <UpgradeCta compact />
        )}
      </div>
      <div className="mb-5">
        <NotificationPrefs
          notifyEmail={business.notify_email}
          notifyWhatsapp={business.notify_whatsapp}
          whatsappPhone={business.whatsapp_phone}
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
      </div>
      <SettingsForm answers={business.onboarding_answers as OnboardingAnswers} />

      {admin && (
        <Link
          href="/admin"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-card px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-edge-strong hover:text-ink"
        >
          <Command className="h-4 w-4" aria-hidden />
          קונסולת אדמין
        </Link>
      )}
    </div>
  );
}
