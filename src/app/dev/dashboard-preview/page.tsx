import { notFound } from "next/navigation";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";

const MOCK: DashboardData = {
  businessName: "הסטודיו של דנה",
  level: { level: 2, title: "רשומים ופעילים", xp: 120, nextAt: 160, progress: 0.6, nextTitle: "מדווחים כמו שצריך" },
  streak: 3,
  scoreOverall: 62,
  categories: [
    { id: "legal-setup", title: "הקמה ורישום", icon: "Landmark", score: 100, done: 4, total: 4 },
    { id: "tax", title: "מיסים והנהלת חשבונות", icon: "Receipt", score: 55, done: 3, total: 6 },
    { id: "finance", title: "פיננסים", icon: "Wallet", score: 40, done: 2, total: 5 },
    { id: "insurance-legal", title: "ביטוח ומשפט", icon: "Shield", score: 30, done: 1, total: 4 },
    { id: "digital-presence", title: "נוכחות דיגיטלית", icon: "Globe", score: 70, done: 4, total: 6 },
    { id: "marketing", title: "שיווק", icon: "Megaphone", score: 25, done: 1, total: 4 },
  ],
  stages: [
    { id: "setup", title: "הקמה", done: 5, total: 5 },
    { id: "operating", title: "תפעול שוטף", done: 6, total: 14 },
    { id: "growth", title: "צמיחה", done: 4, total: 15 },
  ],
  doneCount: 15,
  totalCount: 34,
  overdueCount: 1,
  profilePercent: 80,
  monthlyCost: 640,
  nextAction: { templateId: "professional-liability-insurance", title: "ביטוח אחריות מקצועית", icon: "Shield", priority: "critical" },
  recentWins: [
    { templateId: "open-vat-file", title: "פתיחת תיק עוסק במע\"מ", icon: "Landmark", date: "2026-08-20" },
    { templateId: "invoicing-software", title: "תוכנת חשבוניות", icon: "Receipt", date: "2026-08-22" },
    { templateId: "buy-domain", title: "רכישת דומיין", icon: "Globe", date: "2026-08-25" },
    { templateId: "google-business-profile", title: "פרופיל עסק בגוגל", icon: "Globe", date: "2026-08-28" },
  ],
  earnedBadges: [
    { id: "first-step", title: "הצעד הראשון", icon: "Footprints" },
    { id: "registered", title: "רשומים כחוק", icon: "Landmark" },
    { id: "setup-done", title: "הקמה הושלמה", icon: "Rocket" },
  ],
  urgent: { templateId: "vat-reporting", title: "דיווחי מע\"מ תקופתיים", dueDate: "2026-09-15", daysUntil: 12, periodLabel: "יולי–אוגוסט 2026" },
  upcoming: [
    { templateId: "vat-reporting", title: "דיווחי מע\"מ תקופתיים", dueDate: "2026-09-15", basis: "statutory" },
    { templateId: "annual-tax-report", title: "דוח שנתי למס הכנסה", dueDate: "2027-04-30", basis: "statutory" },
  ],
};

export default async function DashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <DashboardView data={MOCK} />
    </div>
  );
}
