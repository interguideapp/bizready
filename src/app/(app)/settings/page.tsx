import { UpgradeCta } from "@/components/upgrade-cta";
import { PageTitle } from "@/components/ui";
import { getBusiness } from "@/lib/data";
import { isPro } from "@/lib/subscription";
import type { OnboardingAnswers } from "@/lib/types";
import { NotificationPrefs } from "./notification-prefs";
import { SettingsForm } from "./settings-form";
import { SubscriptionBlock } from "./subscription-block";

export default async function SettingsPage() {
  const business = (await getBusiness())!;
  return (
    <div>
      <PageTitle
        title="הגדרות"
        subtitle="שינוי בתשובות מעדכן את תכנית המשימות אוטומטית"
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
    </div>
  );
}
