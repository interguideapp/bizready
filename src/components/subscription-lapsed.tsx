import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { lapsedLabel } from "@/lib/he-distance";
import { formatHeMoment } from "@/lib/dates";

/**
 * What someone sees when their Pro period has ended.
 *
 * Before this they saw the same upgrade pitch as a brand-new user: no mention
 * that they had Pro, that it ended, or that their reminder windows narrowed
 * with it. A payment that stops working is the most likely cause and the
 * easiest to fix, and the person could not tell it had happened.
 *
 * The lapse is knowable because the tier column still reads pro while the
 * period end has passed — so "lapsed" and "never subscribed" are different
 * states, and subscriptionStanding separates them.
 */
export function SubscriptionLapsed({
  untilIso,
  daysAgo,
}: {
  untilIso: string;
  daysAgo: number;
}) {
  return (
    <Card className="border-status-overdue/40 p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-status-overdue">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        המנוי הסתיים
      </h2>
      <p className="mb-1 text-sm text-ink">
        התקופה ששולמה הסתיימה ב־{formatHeMoment(untilIso)}
        {daysAgo > 0 ? ` (${lapsedLabel(daysAgo)})` : ""}. בדרך כלל הסיבה היא
        חיוב שלא עבר — כרטיס שפג תוקפו או שסירב.
      </p>
      <p className="mb-3 text-sm text-ink-muted">
        {/*
          The concrete consequence, not "you lost features". The windows are the
          reason someone paid: without them the first warning arrives later.
        */}
        התזכורות המקדימות חזרו למסלול החינמי, כלומר פחות התראות לפני כל דדליין.
        כל החובות והתאריכים עצמם ממשיכים להופיע כרגיל.
      </p>
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        חידוש המנוי
      </Link>
    </Card>
  );
}
