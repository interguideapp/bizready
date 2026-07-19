import type { Category } from "@/lib/types";

export const CATEGORIES: Category[] = [
  {
    id: "legal-setup",
    title: "הקמה ורישום",
    description: "פתיחת תיקים ברשויות, רישוי והסמכות — הבסיס החוקי של העסק",
    icon: "Landmark",
    sort_order: 1,
  },
  {
    id: "tax",
    title: "מיסים והנהלת חשבונות",
    description: "דיווחים, חשבוניות וניהול ספרים — לעמוד בדרישות רשות המסים",
    icon: "Receipt",
    sort_order: 2,
  },
  {
    id: "finance",
    title: "פיננסים",
    description: "בנק, סליקה, פנסיה ותזרים — הכסף של העסק מסודר",
    icon: "Wallet",
    sort_order: 3,
  },
  {
    id: "insurance-legal",
    title: "ביטוח ומשפט",
    description: "ביטוחים, הסכמים ומסמכים משפטיים שמגנים עליך",
    icon: "Shield",
    sort_order: 4,
  },
  {
    id: "digital-regulation",
    title: "רגולציה דיגיטלית",
    description: "נגישות, פרטיות וחוק הספאם — החובות של העסק ברשת",
    icon: "ScanEye",
    sort_order: 5,
  },
  {
    id: "digital-presence",
    title: "נוכחות דיגיטלית",
    description: "אתר, גוגל ורשתות — שהלקוחות ימצאו אותך",
    icon: "Globe",
    sort_order: 6,
  },
  {
    id: "marketing",
    title: "שיווק",
    description: "מיתוג, קהל יעד ותכנית — להביא לקוחות",
    icon: "Megaphone",
    sort_order: 7,
  },
  {
    id: "operations",
    title: "תפעול",
    description: "תמחור, תהליך מכירה וניהול לקוחות — עסק שעובד חלק",
    icon: "Settings2",
    sort_order: 8,
  },
];
