import { notFound } from "next/navigation";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";

const MOCK: DashboardData = {
  businessName: "הסטודיו של דנה",
  scoreOverall: 62,
  categories: [
    { id: "legal-setup", title: "הקמה ורישום", icon: "Landmark", score: 100, done: 4, total: 4 },
    { id: "tax", title: "מיסים והנהלת חשבונות", icon: "Receipt", score: 55, done: 3, total: 6 },
    { id: "finance", title: "פיננסים", icon: "Wallet", score: 40, done: 2, total: 5 },
    { id: "insurance-legal", title: "ביטוח ומשפט", icon: "Shield", score: 30, done: 1, total: 4 },
    { id: "digital-presence", title: "נוכחות דיגיטלית", icon: "Globe", score: 70, done: 4, total: 6 },
    { id: "marketing", title: "שיווק", icon: "Megaphone", score: 25, done: 1, total: 4 },
  ],
  doneCount: 15,
  totalCount: 34,
  overdueCount: 1,
  profilePercent: 80,
  steps: [
    {
      templateId: "professional-liability-insurance",
      title: "ביטוח אחריות מקצועית",
      icon: "Shield",
      priority: "critical",
      dueDate: "2026-09-20",
      basis: "recommended",
    },
    {
      templateId: "pricing",
      title: "תמחור נכון של השירותים",
      icon: "Settings2",
      priority: "critical",
      dueDate: null,
      basis: "recommended",
    },
    {
      templateId: "google-business-profile",
      title: "פרופיל עסק בגוגל",
      icon: "Globe",
      priority: "critical",
      dueDate: null,
      basis: "recommended",
    },
  ],
  upcoming: [
    { templateId: "vat-reporting", title: "דיווחי מע\"מ תקופתיים", dueDate: "2026-09-15", basis: "statutory" },
    { templateId: "income-tax-advances", title: "הסדרת מקדמות מס הכנסה", dueDate: "2026-09-15", basis: "statutory" },
    { templateId: "annual-tax-report", title: "דוח שנתי למס הכנסה", dueDate: "2027-04-30", basis: "statutory" },
  ],
  urgent: {
    templateId: "vat-reporting",
    title: "דיווחי מע\"מ תקופתיים",
    dueDate: "2026-09-15",
    daysUntil: 12,
    periodLabel: "יולי–אוגוסט 2026",
  },
};

export default async function DashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <DashboardView data={MOCK} />
    </div>
  );
}
