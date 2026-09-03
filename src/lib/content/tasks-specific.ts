import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-09-03";

/**
 * Business-type–specific tasks: commerce/products and field packages
 * (food, creative, construction). Each is gated tightly by applies_when so
 * only the businesses that need it ever see it.
 */
export const SPECIFIC_TASKS: TaskTemplate[] = [
  // ============ מסחר ומוצרים (digital-presence / operations) ============
  {
    id: "online-store-setup",
    category_id: "digital-presence",
    title: "הקמת חנות דיגיטלית",
    why: "אם מוכרים מוצרים אונליין — צריך חנות שמאפשרת עגלה, תשלום ומעקב הזמנות. דף נחיתה לבד לא מספיק למכירה.",
    steps: `1. בחרו פלטפורמה: פתרון ישראלי, Shopify, או WooCommerce על אתר קיים
2. הקימו קטלוג: תמונות איכותיות, תיאור, מחיר ומלאי לכל מוצר
3. חברו סליקה ומדיניות משלוחים והחזרות (ראו משימות נפרדות)
4. הגדירו חשבונית/קבלה אוטומטית על כל הזמנה
5. בדקו רכישת אמת מקצה לקצה לפני השקה`,
    variants: [
      {
        when: { product_type: ["digital_products"] },
        why: "למוצרים דיגיטליים (קבצים, קורסים, מנויים) צריך פלטפורמה שמספקת את המוצר אוטומטית אחרי תשלום — בלי משלוחים.",
        steps: `1. בחרו פלטפורמה למוצרים דיגיטליים: מכירת קבצים/קורסים/מנויים עם אספקה אוטומטית
2. הגדירו אספקה מיידית אחרי תשלום (הורדה/גישה/קוד)
3. חברו סליקה וחשבונית אוטומטית
4. הגדירו מדיניות ביטול למוצר דיגיטלי (שונה ממוצר פיזי — בדקו את זכויות הביטול)
5. בדקו רכישה מקצה לקצה`,
      },
    ],
    official_links: [],
    docs_needed: ["תמונות ותיאורי מוצרים", "מחירון"],
    est_cost: "מחינם עד כמה מאות ₪ בחודש",
    est_time: "שבוע-שבועיים",
    completion: {
      confirm: "החנות הדיגיטלית פעילה ובדקתי רכישה",
      fields: [{ key: "url", label: "כתובת החנות", type: "url", required: true }],
    },
    applies_when: {
      sales_channel: ["online", "both"],
      product_type: ["physical_products", "digital_products", "mixed"],
    },
    depends_on: ["build-website"],
    priority: "critical",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },
  {
    id: "shipping-returns-policy",
    category_id: "operations",
    pitfalls: [
      "לא לפרסם מדיניות ברורה — חוק מכר מרחוק מחייב זמני אספקה, עלויות וזכות ביטול; חוסר בהירות = תלונות וקנסות.",
      "להתעלם מזכות הביטול בעסקת מכר מרחוק לפי חוק הגנת הצרכן.",
    ],
    title: "מדיניות משלוחים והחזרות",
    why: "במכירת מוצרים פיזיים אונליין החוק (מכר מרחוק) מחייב מדיניות ברורה — זמני אספקה, עלויות משלוח וזכות ביטול. חוסר בהירות = תלונות וקנסות.",
    steps: `1. הגדירו זמני אספקה ריאליים ועלויות משלוח לפי אזור
2. כתבו מדיניות החזרות תואמת חוק הגנת הצרכן (זכות ביטול בעסקת מכר מרחוק)
3. בחרו ספק שילוח/שליחויות והסדירו איסוף
4. פרסמו את המדיניות בבירור בחנות ובתהליך הרכישה`,
    official_links: [
      { label: "ביטול עסקת מכר מרחוק — כל-זכות", url: "https://www.kolzchut.org.il/he/ביטול_עסקת_מכר_מרחוק" },
    ],
    docs_needed: [],
    est_cost: "לפי ספק השילוח",
    est_time: "כמה שעות",
    applies_when: {
      sales_channel: ["online", "both"],
      product_type: ["physical_products", "mixed"],
    },
    depends_on: [],
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/ביטול_עסקת_מכר_מרחוק",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },
  {
    id: "inventory-basics",
    category_id: "operations",
    title: "ניהול מלאי בסיסי",
    why: "מכירת מוצר שאזל = לקוח מאוכזב; עודף מלאי = כסף תקוע. מעקב פשוט מונע את שניהם ומזין נכון את החשבונאות.",
    steps: `1. נהלו רשימת מלאי: מוצר, כמות במלאי, נקודת הזמנה מחדש
2. עדכנו אחרי כל מכירה וקבלת סחורה (בחנות דיגיטלית — לרוב אוטומטי)
3. קבעו ספירת מלאי תקופתית להתאמה מול הרישום
4. שמרו קשר עם הספקים ומועדי אספקה`,
    official_links: [],
    docs_needed: [],
    est_cost: "מחינם (טבלה) עד תוכנה ייעודית",
    est_time: "שעה להקמה, שוטף",
    applies_when: { product_type: ["physical_products", "mixed"] },
    depends_on: [],
    priority: "recommended",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },

  // ============ חבילות לפי תחום ============
  {
    id: "food-hygiene-training",
    category_id: "legal-setup",
    pitfalls: [
      "לפעול בלי הדרכת היגיינה כנדרש — מסכן את הרישיון ואת הלקוחות, וחושף לסגירה.",
      "לא לתעד טמפרטורות ואחסון — הפיקוח יבדוק; היעדר תיעוד הוא ליקוי.",
    ],
    title: "הדרכת היגיינה ובטיחות מזון",
    why: "עסק מזון מחויב בעמידה בדרישות משרד הבריאות — כולל הדרכת היגיינה לעוסקים במזון. אי-עמידה מסכנת את הרישיון ואת הלקוחות.",
    steps: `1. בדקו מול הרשות המקומית ומשרד הבריאות אילו דרישות היגיינה חלות על סוג המזון שלכם
2. עברו/ודאו הדרכת נאמן היגייני / עוסק במזון כנדרש
3. הסדירו נהלי אחסון, קירור וטמפרטורות, ותיעוד
4. שמרו את התעודות בארכיון — ייבדקו בפיקוח`,
    official_links: [
      { label: "רישוי עסקי מזון — משרד הבריאות", url: "https://www.gov.il/he/departments/topics/food_licensing" },
    ],
    docs_needed: ["תעודות הדרכה"],
    est_cost: "לפי ההדרכה",
    est_time: "לפי דרישות התחום",
    applies_when: { field: ["food"] },
    depends_on: [],
    deadline_days: 30,
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/topics/food_licensing",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },
  {
    id: "ip-usage-agreement",
    category_id: "insurance-legal",
    title: "קניין רוחני וזכויות שימוש בהסכם",
    why: "בעיצוב, תוכן ופיתוח — מי הבעלים של התוצר? בלי סעיף ברור בהסכם, לקוח יכול לטעון לבעלות מלאה, ואתם תאבדו את הזכות להציג עבודות בתיק.",
    steps: `1. הגדירו בהסכם הלקוח: מה מועבר ללקוח ומה נשאר שלכם (קבצי מקור, זכות שימוש חוזר)
2. קבעו רישיון שימוש: היקף, בלעדיות, ותנאי תשלום להעברת זכויות מלאה
3. שמרו זכות להציג את העבודה בתיק העבודות (portfolio) אלא אם סוכם אחרת
4. הבהירו טיפול בקנסות/עיכובים ובבעלות על נכסים של צד ג' (פונטים, תמונות סטוק)`,
    official_links: [
      { label: "זכויות יוצרים — כל-זכות", url: "https://www.kolzchut.org.il/he/זכויות_יוצרים" },
    ],
    docs_needed: [],
    est_cost: "תבנית חינם; ליווי עו\"ד לפי צורך",
    est_time: "שעה-שעתיים",
    applies_when: { field: ["creative", "tech"] },
    depends_on: ["client-agreement"],
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/זכויות_יוצרים",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },
  {
    id: "construction-insurance-safety",
    category_id: "insurance-legal",
    pitfalls: [
      "להתחיל עבודה בלי ביטוח עבודות קבלניות (CAR) — החשיפה לנזק לרכוש, לעובדים ולצד ג' עצומה.",
      "להזניח דרישות בטיחות/ממונה בטיחות בפרויקטים גדולים — לקוחות עסקיים ידרשו לראות אישורים.",
    ],
    title: "ביטוח עבודות קבלניות ובטיחות",
    why: "בבנייה ושיפוצים החשיפה עצומה — נזק לרכוש, פגיעה בעובדים או בצד ג'. ביטוח עבודות קבלניות ובטיחות בסיסית הם תנאי להתחיל לעבוד.",
    steps: `1. הסדירו **ביטוח עבודות קבלניות** (CAR) המכסה את האתר, צד ג' וחבות מעבידים
2. ודאו עמידה בדרישות בטיחות בעבודה — ציוד מגן, נהלים, וממונה בטיחות אם נדרש
3. בפרויקטים גדולים — בדקו דרישות רישוי ותיאום בטיחות ייעודיות
4. תייקו פוליסות ואישורים; לקוחות עסקיים ידרשו לראות אותם`,
    official_links: [
      { label: "בטיחות בעבודה — מינהל הבטיחות", url: "https://www.gov.il/he/departments/labor_safety_administration" },
    ],
    docs_needed: ["פירוט סוגי העבודות"],
    est_cost: "לפי היקף הפרויקטים",
    est_time: "כמה ימים",
    recurrence: "yearly",
    applies_when: { field: ["construction"] },
    depends_on: [],
    deadline_days: 30,
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/labor_safety_administration",
    last_reviewed: REVIEWED,
    sort_order: 8,
  },
];
