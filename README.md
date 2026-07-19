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

## פריסה ל-Vercel — צ'קליסט

1. **ייבוא הריפו** ב-Vercel → New Project → בחירת הריפו הזה (Next.js מזוהה אוטומטית).
2. **Environment Variables** — הוסיפו לפחות את `NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY`. להפעלת התזכורות הוסיפו גם `SUPABASE_SERVICE_ROLE_KEY` (מ-Supabase → Project Settings → API → service_role) ו-`CRON_SECRET` (מחרוזת אקראית).
3. **Deploy**.
4. **Supabase Auth** → Authentication → URL Configuration: הוסיפו את דומיין הפרודקשן ל-Redirect URLs (`https://<domain>/auth/callback`) ול-Site URL. אם משתמשים ב-Google — הגדירו OAuth ב-Supabase + ב-Google Cloud Console עם ה-redirect של Supabase.
5. **Cron** — `vercel.json` כבר מגדיר סריקה יומית ב-06:00. ודאו ש-`SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` מוגדרים כדי שתפעל.

> הערה: המידע התוכני מבוסס על מקורות רשמיים (gov.il, רשות המסים, ביטוח לאומי, הרשות להגנת הפרטיות) ונכון לתאריך `last_reviewed` שבכל תבנית. סכומים ותקרות (כמו תקרת עוסק פטור) מנוהלים כערכי תצורה ב-`src/lib/types.ts` ומתעדכנים שנתית. כל תוכן משפטי/מיסויי מלווה בדיסקליימר — אינו מהווה ייעוץ.
