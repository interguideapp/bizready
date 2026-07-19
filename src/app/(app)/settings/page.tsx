import { PageTitle } from "@/components/ui";
import { getBusiness } from "@/lib/data";
import type { OnboardingAnswers } from "@/lib/types";
import { NotificationPrefs } from "./notification-prefs";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const business = (await getBusiness())!;
  return (
    <div>
      <PageTitle
        title="הגדרות"
        subtitle="שינוי בתשובות מעדכן את תכנית המשימות אוטומטית"
      />
      <div className="mb-5">
        <NotificationPrefs
          notifyEmail={business.notify_email}
          notifyWhatsapp={business.notify_whatsapp}
          whatsappPhone={business.whatsapp_phone}
        />
      </div>
      <SettingsForm answers={business.onboarding_answers as OnboardingAnswers} />
    </div>
  );
}
