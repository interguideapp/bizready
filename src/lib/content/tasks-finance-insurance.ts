import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-07-18";

export const FINANCE_INSURANCE_TASKS: TaskTemplate[] = [
  // ============ פיננסים ============
  {
    id: "business-bank-account",
    category_id: "finance",
    title: "חשבון בנק נפרד לעסק",
    why: "ערבוב כספי עסק ובית הופך את הנהלת החשבונות לסיוט ומקשה על הצהרת הון. הפרדה מהיום הראשון = שקט.",
    steps: `1. עוסק פטור/מורשה לא חייב "חשבון עסקי" יקר — מספיק חשבון פרטי נוסף המיועד רק לעסק
2. השוו עמלות בין בנקים (כולל דיגיטליים) — עצמאי בתחילת דרכו יכול לקבל פטורים
3. כל הכנסות והוצאות העסק עוברות רק דרך החשבון הזה
4. העבירו "משכורת" לעצמכם לחשבון הפרטי בסכום קבוע
5. תייקו את פרטי החשבון בכרטיס העסק`,
    official_links: [],
    docs_needed: ["תעודת זהות", "תעודת עוסק"],
    est_cost: "עמלות שוטפות — השוו לפני",
    est_time: "שעה-שעתיים",
    completion: {
      confirm: "יש לי חשבון נפרד שמשמש רק את העסק",
      fields: [
        { key: "bank_name", label: "שם הבנק", required: true, writesTo: "bank_name" },
        { key: "bank_account", label: "מספר חשבון", writesTo: "bank_account" },
      ],
    },
    applies_when: {},
    depends_on: [],
    deadline_days: 21,
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "payment-solution",
    category_id: "finance",
    title: "פתרון סליקה וקבלת תשלומים",
    why: "לקוח שרוצה לשלם ולא יכול — הולך. אשראי, ביט והעברה בנקאית מכסים כמעט כל לקוח בישראל.",
    steps: `1. מיפוי: איך הלקוחות שלכם מעדיפים לשלם? (אשראי, ביט/פייבוקס, מזומן, העברה)
2. השוו חברות סליקה לפי עמלה, דמי חודש והתאמה לנפח שלכם
3. לעסק אונליין: ודאו שהסליקה משתלבת באתר ובדף התשלום
4. חברו את הסליקה לתוכנת החשבוניות — קבלה אוטומטית על כל תשלום
5. בדקו עסקת אמת קטנה מקצה לקצה`,
    official_links: [],
    docs_needed: ["תעודת עוסק", "חשבון בנק"],
    est_cost: "עמלה של כ-1%–3% לעסקה",
    est_time: "כמה ימים לאישור",
    applies_when: {},
    depends_on: ["business-bank-account"],
    deadline_days: 30,
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "cashflow-budget",
    category_id: "finance",
    title: "ניהול תזרים ותקציב בסיסי",
    why: "עסקים רווחיים נסגרים בגלל תזרים. לדעת כמה נכנס, כמה יוצא ומתי — זה ההבדל בין עסק לבין הפתעות.",
    steps: `1. פתחו טבלה פשוטה: הכנסות צפויות מול הוצאות קבועות (תוכנות, ביטוחים, מקדמות) ומשתנות
2. קבעו "משכורת" חודשית ריאלית לעצמכם
3. בנו כרית ביטחון של 3 חודשי הוצאות
4. עדכנו את הטבלה פעם בחודש — באותו מפגש חודשי של ניהול הספרים`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעתיים להקמה, חצי שעה בחודש",
    applies_when: {},
    depends_on: [],
    recurrence: "monthly",
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "mandatory-pension",
    category_id: "finance",
    title: "פנסיה חובה לעצמאים",
    why: "זו חובה חוקית מ-2017, לא המלצה — ורוב העצמאים החדשים לא יודעים. מעבר לחוק: הפקדות מזכות בהטבות מס משמעותיות.",
    steps: `1. החובה חלה על עצמאי מגיל 21 עד 60, החל מחצי שנה אחרי הרישום כעוסק
2. שיעורי החובה (2026): 4.45% מההכנסה עד מחצית השכר הממוצע (₪13,769 לחודש), ו-12.55% מהחלק שבין מחצית לשכר הממוצע המלא
3. פתחו קרן פנסיה — השוו דמי ניהול בין הקרנות (כולל קרנות ברירת המחדל הזולות)
4. הגדירו הוראת קבע חודשית; אפשר גם הפקדה שנתית לפני סוף השנה
5. שמרו את אישור ההפקדה השנתי לדוח השנתי — הוא שווה החזר מס`,
    official_links: [
      { label: "ביטוח פנסיוני לעובד עצמאי — כל-זכות", url: "https://www.kolzchut.org.il/he/ביטוח_פנסיוני_לעובד_עצמאי" },
    ],
    docs_needed: ["תעודת זהות", "הערכת הכנסה חודשית"],
    est_cost: "לפי ההכנסה — זו חובה חוקית",
    est_time: "שעה-שעתיים",
    completion: {
      confirm: "יש לי קרן פנסיה פעילה עם הפקדות שוטפות",
      fields: [
        { key: "fund", label: "שם קרן הפנסיה", required: true },
        { key: "monthly", label: "סכום ההפקדה החודשי (₪)" },
      ],
    },
    applies_when: {},
    depends_on: ["open-bituach-leumi-file"],
    deadline_days: 180,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/ביטוח_פנסיוני_לעובד_עצמאי",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "keren-hishtalmut",
    category_id: "finance",
    title: "קרן השתלמות לעצמאים",
    why: "אפיק החיסכון היחיד עם פטור ממס רווחי הון (עד התקרה) + ההפקדה מוכרת כהוצאה. ההטבה הכי משתלמת לעצמאים.",
    steps: `1. פתחו קרן השתלמות במעמד עצמאי — השוו דמי ניהול ומסלולים
2. הפקדה מוכרת לניכוי עד 4.5% מההכנסה החייבת (עד תקרה שנתית מתעדכנת)
3. הכסף נזיל אחרי 6 שנים — ופטור ממס רווחי הון עד תקרת ההפקדה המוטבת
4. נצלו את התקרה לפני סוף שנת המס`,
    official_links: [
      { label: "קרן השתלמות לעצמאים — כל-זכות", url: "https://www.kolzchut.org.il/he/קרן_השתלמות_לעצמאים" },
    ],
    docs_needed: [],
    est_time: "שעה",
    applies_when: { expected_revenue: ["60k_to_ceiling", "over_ceiling"] },
    depends_on: [],
    priority: "recommended",
    source_url: "https://www.kolzchut.org.il/he/קרן_השתלמות_לעצמאים",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "tax-money-aside",
    category_id: "finance",
    title: "הפרשת כסף למיסים בצד",
    why: "המס לא יורד אוטומטית כמו אצל שכירים. מי שלא שם בצד — מגלה בסוף שנה חוב של עשרות אלפי שקלים שכבר בוזבז.",
    steps: `1. כלל אצבע לעצמאי מתחיל: הפרישו 25%–35% מכל הכנסה לחשבון/פיקדון נפרד
2. מהכסף הזה משלמים: מקדמות מס, ביטוח לאומי, מע"מ (מורשה) והשלמות בדוח השנתי
3. אחרי הדוח השנתי הראשון תדעו את השיעור האמיתי שלכם ותדייקו
4. מה שנשאר עודף — הפקידו לפנסיה/השתלמות וקבלו הטבת מס`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "5 דקות בכל הכנסה",
    applies_when: {},
    depends_on: [],
    recurrence: "monthly",
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },

  // ============ ביטוח ומשפט ============
  {
    id: "professional-liability-insurance",
    category_id: "insurance-legal",
    title: "ביטוח אחריות מקצועית",
    why: "טעות מקצועית אחת — טיפול שהשתבש, ייעוץ שגרם נזק — יכולה לעלות יותר מכל מה שהעסק ירוויח בשנים. הביטוח קיים בדיוק בשביל זה.",
    steps: `1. בדקו אם בתחומכם הביטוח חובה (חלק מהמקצועות הטיפוליים והפיננסיים) או קריטי בפועל
2. פנו לסוכן ביטוח או השוו ישירות מול חברות — בקשו כיסוי מותאם לתחום
3. שימו לב לגבול האחריות, ההשתתפות העצמית ולתקופת גילוי רטרואקטיבית
4. תייקו את הפוליסה בארכיון עם תאריך החידוש`,
    official_links: [],
    docs_needed: ["פירוט הפעילות המקצועית"],
    est_cost: "מאות עד אלפי ₪ בשנה, לפי תחום",
    est_time: "שבוע",
    completion: {
      confirm: "יש לי פוליסת אחריות מקצועית בתוקף",
      fields: [
        { key: "insurer", label: "חברת הביטוח / הסוכן", required: true },
        { key: "renewal", label: "תאריך חידוש", type: "date" },
      ],
    },
    applies_when: { field: ["beauty_care", "consulting", "professional", "tech", "food", "construction"] },
    depends_on: [],
    deadline_days: 30,
    recurrence: "yearly",
    priority: "critical",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "third-party-insurance",
    category_id: "insurance-legal",
    title: "ביטוח צד ג'",
    why: "לקוח שמחליק בכניסה לקליניקה או נפגע מציוד שלך — האחריות עליך. רלוונטי לכל עסק שמקבל קהל, גם בבית.",
    steps: `1. העריכו את הסיכון: כמה אנשים מבקרים אצלכם? יש ציוד מסוכן?
2. בקשו הצעות לביטוח צד ג' — לרוב נמכר יחד עם אחריות מקצועית בחבילה משתלמת
3. אם אתם עובדים מהבית — ודאו שהפוליסה מכסה פעילות עסקית בדירה (ביטוח הדירה הרגיל לא מכסה)
4. תייקו את הפוליסה עם תאריך חידוש`,
    official_links: [],
    docs_needed: [],
    est_cost: "מאות ₪ בשנה",
    est_time: "כמה ימים",
    applies_when: { hosts_clients: true },
    depends_on: [],
    deadline_days: 30,
    recurrence: "yearly",
    priority: "critical",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "work-disability-insurance",
    category_id: "insurance-legal",
    title: "ביטוח אובדן כושר עבודה",
    why: "כעצמאי, אם אינך עובד — אין הכנסה. פציעה או מחלה ממושכת בלי כיסוי היא הסיכון הפיננסי הגדול ביותר של עצמאי.",
    steps: `1. בדקו מה כבר יש לכם דרך קרן הפנסיה (רכיב נכות) — לפעמים זה הבסיס
2. שקלו השלמה פרטית עד כ-75% מההכנסה
3. שימו לב להגדרת "עיסוק ספציפי" — שהפוליסה תכסה אי-יכולת לעבוד במקצוע שלכם דווקא
4. ההפרמיה מוכרת חלקית כהוצאה — שמרו אישורים לדוח השנתי`,
    official_links: [
      { label: "ביטוח אובדן כושר עבודה — כל-זכות", url: "https://www.kolzchut.org.il/he/ביטוח_אובדן_כושר_עבודה" },
    ],
    docs_needed: ["פירוט הכנסות"],
    est_cost: "לפי גיל, מקצוע והכנסה",
    est_time: "שבוע",
    applies_when: {},
    depends_on: ["mandatory-pension"],
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/ביטוח_אובדן_כושר_עבודה",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "client-agreement",
    category_id: "insurance-legal",
    title: "הסכם התקשרות עם לקוחות",
    why: "בלי הסכם כתוב, כל אי-הבנה על מחיר, ביטול או אחריות הופכת למלחמה. הסכם טוב מונע 90% מהסכסוכים.",
    steps: `1. כתבו מסמך שמכסה: מה כלול בשירות, מחיר ותנאי תשלום, מדיניות ביטולים, אחריות, וקניין רוחני (אם רלוונטי)
2. אפשר להתחיל מתבנית ולהתאים — אבל לפחות לעסקאות גדולות שווה שעת ייעוץ עם עו"ד
3. החתימו כל לקוח לפני תחילת עבודה (גם אישור במייל/וואטסאפ עדיף מכלום)
4. שמרו עותק חתום בארכיון המסמכים`,
    official_links: [],
    docs_needed: [],
    est_cost: "תבנית חינם; ליווי עו\"ד מכ-₪500",
    est_time: "כמה שעות",
    applies_when: {},
    depends_on: [],
    deadline_days: 45,
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "website-terms",
    category_id: "insurance-legal",
    title: "תנאי שימוש לאתר",
    why: "תנאי שימוש מגדירים את כללי המשחק מול הגולשים ומגנים עליך משפטית — במיוחד אם מוכרים אונליין.",
    steps: `1. כתבו תנאי שימוש שמכסים: זהות העסק, תנאי רכישה וביטול (כולל זכויות ביטול עסקה לפי חוק הגנת הצרכן), אחריות והגבלותיה
2. במכירה אונליין: פרטו מדיניות משלוחים והחזרות ברורה
3. הציבו קישור נגיש בתחתית האתר ובתהליך הרכישה
4. עדכנו כשמשהו משתנה במודל העסקי`,
    official_links: [
      { label: "ביטול עסקה בקנייה מרחוק — כל-זכות", url: "https://www.kolzchut.org.il/he/ביטול_עסקת_מכר_מרחוק" },
    ],
    docs_needed: [],
    est_cost: "תבנית חינם; עו\"ד מכ-₪800",
    est_time: "כמה שעות",
    applies_when: { has_website: true },
    depends_on: [],
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/ביטול_עסקת_מכר_מרחוק",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "privacy-policy",
    category_id: "insurance-legal",
    title: "מדיניות פרטיות תואמת תיקון 13",
    why: "מאז אוגוסט 2025 חוק הגנת הפרטיות המעודכן (תיקון 13) חל על כל עסק שאוסף מידע אישי — עם עיצומים כספיים משמעותיים על הפרות.",
    steps: `1. מפו איזה מידע אישי אתם אוספים (שמות, טלפונים, מיילים, פרטי בריאות) ולמה
2. כתבו מדיניות פרטיות שמפרטת: איזה מידע נאסף, למה, האם חלה חובה חוקית למסור אותו, זהות בעל המאגר ודרכי יצירת קשר, וזכויות העיון והתיקון
3. פרסמו אותה באתר ובכל טופס איסוף פרטים
4. אספו רק מה שבאמת צריך — פחות מידע = פחות סיכון`,
    official_links: [
      { label: "הרשות להגנת הפרטיות — gov.il", url: "https://www.gov.il/he/departments/the_privacy_protection_authority" },
    ],
    docs_needed: ["מיפוי סוגי המידע שנאסף"],
    est_cost: "תבנית חינם; ליווי מקצועי לפי צורך",
    est_time: "כמה שעות",
    applies_when: { collects_personal_data: true },
    depends_on: [],
    deadline_days: 30,
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/the_privacy_protection_authority",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },
];
