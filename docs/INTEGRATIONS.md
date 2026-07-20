# מדריך אינטגרציות — BizReady

כל מערכת חיצונית מתחברת דרך אחד משלושה מצבים: **API ישיר** (ספקי חשבוניות), **Webhook מתוקנן** (הכל — ישירות או דרך Make/Zapier), או **CSV**. הנתונים מתנרמלים למודל אחיד ומתיישבים אוטומטית: מחזור וצפי בתובנות, מעקב תקרת עוסק פטור, בדיקת מספרי הקצאה (חשבוניות ישראל), אימות משימות, והתראות.

## סכמת האירועים המתוקננת (Webhook)

שולחים `POST` לכתובת החיבור (`/api/hooks/<token>`), עם JSON יחיד או `{"events": [...]}`:

| אירוע | שדות data | דוגמה |
|---|---|---|
| `document.created` | `id`, `amount` (חובה); `kind` (invoice/receipt/credit/quote), `vat_amount`, `date`, `customer_name`, `allocation_number`, `status` | חשבונית שהופקה |
| `payment.received` / `payment.failed` | `id`, `amount` (חובה); `date`, `customer_name` | עסקת סליקה |
| `lead.created` / `lead.updated` | `id` (חובה); `name`, `stage` (lead/prospect/customer/lost), `source`, `value`, `date` | ליד חדש / שינוי שלב |
| `order.created` / `order.updated` | `id`, `total` (חובה); `status`, `items_count`, `date` | הזמנה בחנות |

```bash
curl -X POST https://biz-ready.vercel.app/api/hooks/<TOKEN> \
  -H "Content-Type: application/json" \
  -d '{"event":"document.created","data":{"id":"inv-1001","amount":1200,"kind":"invoice","date":"2026-07-20","customer_name":"דנה לוי","allocation_number":"123456789"}}'
```

**חתימת HMAC (אם הופעל Secret):** שלחו כותרת `x-bizready-signature` עם `hex(hmac_sha256(secret, body))`. ב-Make/Zapier אפשר בלי Secret — הטוקן בכתובת הוא סודי בעצמו.

## מתכונים לפי מערכת

### חשבוניות — Green Invoice / Morning (API ישיר)
1. בחשבון: הגדרות ← חיבור מערכות (API) ← יצירת מפתח → מעתיקים ID + Secret.
2. במסך האינטגרציות: חשבוניות ← Green Invoice ← מדביקים ← "בדיקה וחיבור".
3. מה קורה: מסמכים נמשכים בסנכרון לילי (או "סנכרן עכשיו"); משימת "תוכנת חשבוניות" מאומתת אוטומטית; המחזור מזין את התובנות ואת מעקב התקרה; חשבונית ≥ ₪5,000 בלי מספר הקצאה → שגיאה + התראה.

### חשבוניות — iCount (API ישיר)
כמו למעלה, עם מזהה חברה (CID) + משתמש + סיסמה. מומלץ משתמש API ייעודי עם הרשאת צפייה.

### סליקה — Grow / Cardcom / Tranzila / PayPlus / PayPal / Stripe
אצל הספק (או דרך Make): Webhook על "עסקה מוצלחת" → שולח `payment.received` לכתובת שלנו. תשלומים נרשמים במטריקה נפרדת (בלי כפל מול חשבוניות), ומשימת "פתרון סליקה" מאומתת.

### חנות — Shopify / WooCommerce / Wix
- Shopify: Settings → Notifications → Webhooks → Order creation → כתובת שלנו (`order.created`).
- Woo: תוסף Webhooks מובנה.
- Wix: Automations → "הזמנה חדשה" → Webhook.

### CRM ולידים — Fireberry / monday / HubSpot / Lead Ads / Google Sheets
תרחיש Make/Zapier: טריגר "ליד חדש"/"שורה חדשה"/"Lead Ad" → POST `lead.created` עם `source`. שינוי שלב → `lead.updated` עם `stage`.

### דיוור וביקורות — רב מסר / ActiveTrail / ביקורות Google
נרשם חדש → `lead.created` עם `source:"newsletter"`. ביקורת חדשה בגוגל (דרך Zapier) → `lead.created` עם `source:"google-review"` ו-`value` = הדירוג.

### CSV — חשבשבת / דוח רו"ח / Bit / בנק / שכר
מייצאים מהמערכת ומעלים במסך האינטגרציות. עמודות מזוהות אוטומטית (אנגלית או עברית):
- מסמכים: `date/תאריך, amount/סכום, vat/מע"מ, customer/לקוח, allocation_number/מספר הקצאה`
- לידים: `name/שם, source/מקור, value/שווי, date/תאריך`
- הזמנות: `total/סכום, status/סטטוס, date/תאריך`

## לאן כל נתון מתיישב

| נתון | יעד |
|---|---|
| חיבור חשבוניות פעיל | משימת "תוכנת חשבוניות" ✓ אוטומטית (עם אירוע ביומן) |
| חיבור סליקה | משימת "פתרון סליקה" ✓ |
| חיבור CRM | משימת "ניהול לקוחות" ✓ |
| חיבור חנות | ראיה חלקית למשימת האתר (ביומן) |
| סכומי מסמכים | תובנות: מחזור חודשי/שנתי, לקוחות מובילים, צפי |
| מחזור שנתי (עוסק פטור) | התראות תקרה ב-80%/95%/100% + פס התקדמות |
| חשבונית ≥ ₪5,000 בלי הקצאה (מורשה, מ-6/2026) | שגיאה פתוחה + התראה |
| לידים | משפך בתובנות |
| כשל סנכרון | סטטוס אדום בחיבור + התראה |

הכל אידמפוטנטי: שליחה חוזרת של אותו אירוע לא סופרת פעמיים.
