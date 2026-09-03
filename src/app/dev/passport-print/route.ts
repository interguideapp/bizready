import { NextResponse } from "next/server";
import { renderPassportHtml, type PassportData } from "@/lib/documents/passport";

const MOCK: PassportData = {
  businessName: "הסטודיו של דנה",
  entityLabel: "עוסק מורשה",
  generatedAt: "3.9.2026",
  identity: [
    { label: "מספר עוסק", value: "512345678" },
    { label: 'תיק מע"מ', value: "512345678" },
    { label: "תיק מס הכנסה", value: "512345678" },
    { label: "בנק", value: "פועלים" },
    { label: "מספר חשבון", value: "12-345-678901" },
    { label: 'רו"ח / יועץ מס', value: "משה כהן" },
  ],
  levelTitle: "רשומים ופעילים",
  levelNumber: 2,
  score: 62,
  completedCount: 15,
  totalCount: 34,
  badges: ["הצעד הראשון", "רשומים כחוק", "הקמה הושלמה"],
  categories: [
    { title: "הקמה ורישום", score: 100, done: 4, total: 4 },
    { title: "מיסים והנהלת חשבונות", score: 55, done: 3, total: 6 },
    { title: "פיננסים", score: 40, done: 2, total: 5 },
  ],
  obligations: [
    { title: 'דיווחי מע"מ תקופתיים', date: "15.9.2026", period: "יולי–אוגוסט 2026" },
    { title: "דוח שנתי למס הכנסה", date: "30.4.2027", period: "שנת 2026" },
  ],
  documents: [
    { name: "תעודת עוסק.pdf", category: "רישום ואישורים", date: "20.8.2026", expires: null },
    { name: "פוליסת אחריות מקצועית.pdf", category: "ביטוחים", date: "22.8.2026", expires: "22.8.2027" },
  ],
  costs: [
    { name: "תוכנת חשבוניות", amount: "₪49", cadence: "לחודש" },
    { name: "ביטוח אחריות מקצועית", amount: "₪1,800", cadence: "לשנה" },
    { name: "דומיין", amount: "₪80", cadence: "לשנה" },
  ],
  monthlyCost: "₪206",
  annualCost: "₪2,472",
  products: [
    { name: "טיפול פנים", price: "₪280", unit: "unit" },
    { name: "ייעוץ", price: "₪350", unit: "hour" },
  ],
};

export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "nope" }, { status: 404 });
  return new NextResponse(renderPassportHtml(MOCK), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
