# BizReady

פלטפורמת אונבורדינג חכמה לעסקים חדשים בישראל — שאלון קצר → תכנית משימות מותאמת אישית (הקמה, מיסים, פיננסים, ביטוח, רגולציה דיגיטלית, נוכחות, שיווק, תפעול) עם סטטוסים, דדליינים, תזכורות, ציון מוכנות, תיק דיגיטלי (כרטיס עסק + ארכיון מסמכים), מרקטפלייס הצעות שותפים וחנות.

## סטאק

Next.js 16 (App Router, `src/`) · TypeScript · Tailwind v4 · lucide-react · Supabase (Auth · Postgres · RLS · Storage) · Vercel.

## פיתוח מקומי

```bash
npm install
cp .env.local.example .env.local   # מלאו את המשתנים (ראו למטה)
npm run dev
npm test                            # בדיקות יחידה (vitest) למנוע החוקים והתזכורות
```

## מבנה

- `src/lib/content/` — התוכן: 8 קטגוריות + ~48 תבניות משימות (מקור האמת). מיוצא ל-DB דרך `scripts/seed-sql.ts`.
- `src/lib/rules-engine.ts` — מנוע חוקים טהור (התאמת משימות, ציון מוכנות, צעדים הבאים). נבדק ב-`rules-engine.test.ts`.
- `src/lib/reminders.ts` — מנוע תזכורות טהור (דדליינים, איחורים, איפוס משימות מחזוריות). נבדק ב-`reminders.test.ts`.
- `src/app/(app)/` — האזור המחובר: דשבורד, משימות, כרטיס עסק, מסמכים, חנות, התראות, הגדרות.
- `src/app/api/cron/reminders/` — סריקה יומית (Vercel Cron, `vercel.json`).
- `src/lib/integrations/` — מרכז האינטגרציות: מחברי API (Green Invoice, iCount), Webhook מתוקנן, CSV, מנוע השמה (`apply.ts`) שממקם כל נתון — אימות משימות, תקרת פטור, בדיקת הקצאות, תובנות. מדריך מלא: `docs/INTEGRATIONS.md`.
- `src/app/api/hooks/[token]/` — Webhook נכנס; `src/app/api/cron/sync/` — סנכרון לילי.
- `supabase/migrations/` — סכמת ה-DB + RLS.

## משתני סביבה

| משתנה | חובה | לְמה |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | כתובת פרויקט Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | מפתח publishable (בטוח לחשיפה) |
| `SUPABASE_SERVICE_ROLE_KEY` | לתזכורות | מפתח סוד — רק ל-cron. **לעולם לא בצד לקוח.** |
| `CRON_SECRET` | לתזכורות | מגן על `/api/cron/reminders` |
| `NEXT_PUBLIC_APP_URL` | מומלץ | הדומיין בפרודקשן (לקישורים במיילים) |
| `RESEND_API_KEY` + `REMINDER_FROM_EMAIL` | לתזכורות מייל | שליחת מיילים דרך Resend |
| `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (+ `WHATSAPP_TEMPLATE_NAME`) | לוואטסאפ | Meta Cloud API |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | להתראות דחיפה | Web Push. ליצירת מפתחות: `npx web-push generate-vapid-keys`. `VAPID_SUBJECT` הוא `mailto:you@example.com` |

## פריסה ל-Vercel — צ'קליסט

1. **ייבוא הריפו** ב-Vercel → New Project → בחירת הריפו הזה (Next.js מזוהה אוטומטית).
2. **Environment Variables** — הוסיפו לפחות את `NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY`. להפעלת התזכורות הוסיפו גם `SUPABASE_SERVICE_ROLE_KEY` (מ-Supabase → Project Settings → API → service_role) ו-`CRON_SECRET` (מחרוזת אקראית).
3. **Deploy**.
4. **Supabase Auth** → Authentication → URL Configuration: הוסיפו את דומיין הפרודקשן ל-Redirect URLs (`https://<domain>/auth/callback`) ול-Site URL. אם משתמשים ב-Google — הגדירו OAuth ב-Supabase + ב-Google Cloud Console עם ה-redirect של Supabase.
5. **Cron** — `vercel.json` מגדיר ארבע משימות: תזכורות יומיות (06:00), סנכרון
   אינטגרציות (03:00), סריקת שמירת נתונים שבועית (ראשון 04:30) ובדיקת מקורות
   שבועית (שני 05:00). כל אחת מהן נכשלת סגור בלי `CRON_SECRET` — היא רצה עם
   ה-service role, ולכן היעדר הסוד חוסם ולא פותח.
6. **חיוב (אופציונלי)** — עד שמוגדרים `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`
   ו-`STRIPE_WEBHOOK_SECRET`, כפתור השדרוג אומר למשתמש שהמנוי עוד לא פתוח
   במקום לשלוח אותו למסלול שבור. מצב המנוי נכתב רק על ידי ה-webhook המאומת —
   מיגרציה 019 אוכפת את זה ברמת מסד הנתונים, כך שאף נתיב מהדפדפן לא יכול להעניק
   Pro.

### על התוכן והמועדים

המידע מבוסס על מקורות רשמיים (gov.il, רשות המסים, ביטוח לאומי, הרשות להגנת
הפרטיות). מה שמחזיק את זה במקום, ולא רק ההצהרה הזאת:

- **בסיס משפטי מוצהר** לכל משימה (`src/lib/content/legal-basis.ts`). משימה
  מסומנת `critical` רק אם חוק מחייב אותה, וכל טענה כזאת חייבת לצטט מקור רשמי —
  שתי בדיקות build אוכפות את זה.
- **מועדים מתוך רישום כללים** (`src/lib/content/filing-rules.ts`): לכל חובה
  מוצהר העוגן, דף המקור והתאריך שבו אדם בדק אותה מולו. ההסבר למועד נגזר מהכלל,
  כדי שהטקסט לא יוכל לסתור את התאריך שהוא מסביר.
- **סכומים במקום אחד** (`src/lib/content/figures.ts`), כל אחד עם שנת המס
  והמקור שלו, ומשולבים בתוכן כטוקנים. בדיקת build נכשלת אם סכום נכתב ישירות
  בטקסט — כך עדכון שנתי אכן משנה את מה שהמשתמש רואה.
- **תור בדיקה** (`src/lib/content/review-queue.ts`) שמדרג לפי חומרה ולא לפי
  גיל, ובדיקת מקורות שבועית שמזהה שדף רשמי השתנה. שינוי במקור מסומן לאדם —
  התוכן לא מתעדכן אוטומטית מסיגנל כזה.
- כל תוכן משפטי/מיסויי מלווה בדיסקליימר, כולל בדף המשימה עצמו.

לתכנון של שכבת ה-AI — ולמה היא עדיין לא נבנתה — ראו
[`docs/ai-design.md`](docs/ai-design.md).
