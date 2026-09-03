import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-07-20";

/**
 * Employment package — appears only when the business plans to hire
 * (`applies_when: { plans_employees: true }`). The attendance task carries
 * variants so remote/field workers get the app flow and on-site workers the
 * physical-clock flow.
 */
export const EMPLOYMENT_TASKS: TaskTemplate[] = [
  {
    id: "employer-deductions-file",
    category_id: "employment",
    pitfalls: [
      "לשלם משכורת ראשונה לפני פתיחת תיק ניכויים ותיק מעסיק — צריך אותם כדי להעביר את המס ודמי הביטוח כחוק.",
      "לא לשמור את מספרי התיקים — תצטרכו אותם לכל דיווח שכר.",
    ],
    title: "פתיחת תיק ניכויים ותיק מעסיק",
    why: "כדי לשלם שכר כחוק צריך תיק ניכויים במס הכנסה ותיק מעסיק בביטוח לאומי — דרכם מעבירים את המס ודמי הביטוח של העובדים.",
    steps: `1. פתחו **תיק ניכויים** במס הכנסה (טופס 4436) — לפני תשלום המשכורת הראשונה
2. פתחו/עדכנו **תיק מעסיק** בביטוח לאומי
3. אם יש רו"ח/חשב שכר — הוא עושה את זה עבורכם; אחרת דרך האזור האישי
4. שמרו את מספרי התיקים — תצטרכו אותם לכל דיווח שכר`,
    official_links: [
      { label: "פתיחת תיק ניכויים — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
      { label: "מעסיקים — ביטוח לאומי", url: "https://www.btl.gov.il/Insurance/Employers/Pages/default.aspx" },
    ],
    docs_needed: ["מספרי התיקים של העסק"],
    est_cost: "חינם",
    est_time: "שעה (או דרך רו\"ח)",
    completion: {
      confirm: "פתחתי תיק ניכויים ותיק מעסיק",
      fields: [{ key: "deductions_file", label: "מספר תיק ניכויים", required: true }],
    },
    applies_when: { plans_employees: true },
    depends_on: ["open-income-tax-file"],
    deadline_days: 21,
    priority: "critical",
    source_url: "https://www.btl.gov.il/Insurance/Employers/Pages/default.aspx",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "employment-terms-notice",
    category_id: "employment",
    title: "הודעה לעובד על תנאי העסקה",
    why: "חוק מחייב למסור לכל עובד הודעה בכתב על תנאי העסקתו תוך 30 יום מתחילת העבודה (לנוער — 7 ימים). אי-מסירה חושפת לתביעה ולקנס.",
    steps: `1. הכינו תבנית "הודעה על תנאי עבודה" הכוללת: זהות המעסיק והעובד, תאריך תחילת עבודה, תיאור התפקיד, שם הממונה הישיר, גובה השכר ומועד התשלום, אורך יום/שבוע העבודה, יום המנוחה השבועי, והפרשות סוציאליות
2. מסרו לכל עובד תוך 30 יום מתחילת העבודה (נוער — 7 ימים)
3. החתימו על קבלה ושמרו עותק בתיק העובד
4. כל שינוי בתנאים — הודעה מעודכנת תוך 30 יום`,
    official_links: [
      { label: "הודעה על תנאי העבודה — כל-זכות", url: "https://www.kolzchut.org.il/he/הודעה_על_תנאי_העבודה" },
    ],
    docs_needed: ["תבנית הודעה לעובד"],
    est_cost: "תבנית חינם; ליווי עו\"ד לפי צורך",
    est_time: "שעה להכנת התבנית",
    applies_when: { plans_employees: true },
    depends_on: [],
    deadline_days: 30,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/הודעה_על_תנאי_העבודה",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "attendance-tracking",
    category_id: "employment",
    pitfalls: [
      "לא לנהל רישום נוכחות מדויק — בבית הדין נטל ההוכחה על שעות נוספות עובר אליכם, וזה יקר.",
      "לחשוב שעובד מהבית פטור מרישום — החוק מחייב רישום גם לעבודה מרחוק (אפליקציית נוכחות).",
      "לא לשמור את הנתונים 7 שנים — הם הבסיס לתלוש השכר ולהגנה מפני תביעות.",
    ],
    title: "רישום שעות עבודה (נוכחות)",
    why: "החוק מחייב כל מעסיק לנהל רישום נוכחות מדויק — כניסה, יציאה, הפסקות ושעות נוספות. בלי רישום, נטל ההוכחה על שעות נוספות עובר אליכם בבית הדין.",
    // default (on-site) — overridden by variants below
    steps: `1. התקינו פתרון רישום נוכחות במקום העבודה: שעון נוכחות פיזי, טאבלט עם אפליקציה, או קורא כרטיסים
2. ודאו שנרשמים: שעת כניסה, יציאה, הפסקות, שעות נוספות ושעות לילה
3. הגדירו לכל עובד קוד/כרטיס אישי
4. שמרו את הנתונים לפחות 7 שנים — הם הבסיס לתלוש השכר`,
    variants: [
      {
        when: { employee_work_mode: ["remote"] },
        why: "החוק מחייב רישום נוכחות מדויק גם לעובדים מהבית. לעבודה מרחוק אפליקציית נוכחות היא הפתרון הנכון.",
        steps: `1. בחרו **אפליקציית נוכחות** שבה העובד מדווח כניסה/יציאה מהטלפון (יש שירותים ישראליים זולים)
2. ודאו שהאפליקציה מתעדת: שעת התחלה, סיום, הפסקות ושעות נוספות
3. הגדירו למי מותר לאשר/לתקן דיווחים
4. הסבירו לעובדים את נוהל הדיווח — דיווח אמין הוא באחריותם ובאחריותכם
5. שמרו את הדוחות לפחות 7 שנים`,
      },
      {
        when: { employee_work_mode: ["field"] },
        why: "לעובדים בשטח/אצל לקוחות צריך רישום נוכחות נייד — עדיף עם אימות מיקום כדי לתעד נכון.",
        steps: `1. בחרו **אפליקציית נוכחות ניידת** עם דיווח מהטלפון, רצוי עם תיוג מיקום (GPS)
2. תעדו כניסה/יציאה לכל אתר או משימה, כולל נסיעות בין לקוחות
3. הגדירו כללי הפסקות ושעות נוספות
4. שקלו שילוב עם החזר נסיעות (ראו משימה נפרדת)
5. שמרו את הדוחות לפחות 7 שנים`,
      },
      {
        when: { employee_work_mode: ["mixed"] },
        why: "לצוות משולב צריך פתרון אחד שמכסה גם עבודה במקום וגם מרחוק/בשטח.",
        steps: `1. בחרו מערכת נוכחות שתומכת **גם בשעון/טאבלט במשרד וגם בדיווח מהאפליקציה** מרחוק
2. הגדירו לכל עובד את שיטת הדיווח המתאימה לו
3. ודאו תיעוד מלא: כניסה, יציאה, הפסקות, שעות נוספות
4. שמרו את הדוחות לפחות 7 שנים`,
      },
    ],
    official_links: [
      { label: "רישום שעות עבודה — כל-זכות", url: "https://www.kolzchut.org.il/he/רישום_שעות_עבודה" },
    ],
    docs_needed: [],
    est_cost: "משעון בסיסי עד כמה עשרות ₪ לעובד/חודש באפליקציה",
    est_time: "כמה ימים להטמעה",
    completion: {
      confirm: "יש לי מערכת שמתעדת שעות עבודה לכל עובד",
      fields: [{ key: "system", label: "שם המערכת / הפתרון", required: true }],
    },
    applies_when: { plans_employees: true },
    depends_on: [],
    deadline_days: 14,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/רישום_שעות_עבודה",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "payroll-solution",
    category_id: "employment",
    pitfalls: [
      "לשלם שכר אחרי ה-9 בחודש העוקב — איחור מעבר לכך צובר פיצויי הלנת שכר.",
      "תלוש חסר רכיבי חובה (שעות נוספות, הפרשות, צבירת חופשה/מחלה) — חושף לתביעות והפרשי שכר.",
      "לא להעביר את הניכויים למס הכנסה ולביטוח לאומי בזמן.",
    ],
    title: "פתרון שכר ותלושים כדין",
    why: "כל עובד חייב לקבל תלוש שכר מפורט וחוקי בכל חודש. שכר לא-תקין או בלי תלוש = עבירה וקנסות.",
    steps: `1. החליטו: **חשב שכר / רו"ח** (מומלץ אם יש כמה עובדים) או תוכנת שכר עצמאית
2. ודאו שהתלוש כולל את כל רכיבי החובה: שכר יסוד, שעות נוספות, ניכויים, הפרשות סוציאליות, ימי חופשה/מחלה צבורים
3. שלמו שכר עד ה-9 בחודש העוקב (איחור מעבר לכך צובר פיצויי הלנת שכר)
4. העבירו ניכויים למס הכנסה ולביטוח לאומי בזמן`,
    official_links: [
      { label: "תלוש שכר — כל-זכות", url: "https://www.kolzchut.org.il/he/תלוש_שכר" },
    ],
    docs_needed: [],
    est_cost: "כ-₪30–₪70 לתלוש (חשב שכר)",
    est_time: "התארגנות ראשונית + שוטף חודשי",
    recurrence: "monthly",
    completion: {
      confirm: "יש לי דרך להפיק תלושי שכר כדין",
      fields: [{ key: "provider", label: "חשב שכר / תוכנה", required: true }],
    },
    applies_when: { plans_employees: true },
    depends_on: ["employer-deductions-file"],
    deadline_days: 30,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/תלוש_שכר",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "employee-pension-setup",
    category_id: "employment",
    title: "ביטוח פנסיוני לעובדים",
    why: "חובה לבטח כל עובד בפנסיה. עובד ללא פנסיה קודמת — אחרי 6 חודשים; עם קרן פעילה — כמעט מיד. אי-הפרשה היא חוב שנצבר.",
    steps: `1. בררו מכל עובד אם יש לו כבר קרן פנסיה פעילה
2. הסדירו הפרשות לפי צו ההרחבה לפנסיה חובה (חלק מעסיק, חלק עובד ופיצויים)
3. חשב השכר בדרך כלל מטפל בהעברות — ודאו שזה קורה מהחודש הראשון הרלוונטי
4. שמרו אישורי הפקדה`,
    official_links: [
      { label: "פנסיית חובה לשכירים — כל-זכות", url: "https://www.kolzchut.org.il/he/פנסיה_חובה" },
    ],
    docs_needed: [],
    est_cost: "אחוז מהשכר (חלק מעסיק)",
    est_time: "חלק מהקמת השכר",
    applies_when: { plans_employees: true },
    depends_on: ["payroll-solution"],
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/פנסיה_חובה",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "employer-liability-insurance",
    category_id: "employment",
    title: "ביטוח חבות מעבידים",
    why: "עובד שנפגע בעבודה יכול לתבוע אתכם ישירות מעבר לביטוח הלאומי. ביטוח חבות מעבידים מכסה את החשיפה הזו — קריטי מהעובד הראשון.",
    steps: `1. פנו לסוכן ביטוח לביטוח חבות מעבידים (לרוב נמכר יחד עם צד ג'/אחריות מקצועית)
2. התאימו את גבול האחריות למספר העובדים ולתחום
3. ודאו שהפוליסה מכסה את כל סוגי העובדים (כולל זמניים)
4. תייקו את הפוליסה עם תאריך חידוש`,
    official_links: [],
    docs_needed: ["מספר עובדים צפוי", "תיאור הפעילות"],
    est_cost: "מאות עד אלפי ₪ בשנה",
    est_time: "כמה ימים",
    recurrence: "yearly",
    applies_when: { plans_employees: true },
    depends_on: [],
    deadline_days: 30,
    priority: "critical",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },
  {
    id: "travel-reimbursement",
    category_id: "employment",
    title: "החזר הוצאות נסיעה לעבודה",
    why: "לפי צו הרחבה, מעסיק חייב להחזיר לעובד הוצאות נסיעה לעבודה וממנה (עד תקרה יומית). זה רכיב חובה בתלוש.",
    steps: `1. בררו מכל עובד את עלות הנסיעה היומית (תחבורה ציבורית או חלופה)
2. שלמו החזר נסיעות עד התקרה היומית שנקבעה בצו — כרכיב בתלוש
3. תעדו את הבסיס לחישוב לכל עובד`,
    variants: [
      {
        when: { employee_work_mode: ["field"] },
        why: "לעובדי שטח שנוסעים ברכבם בין לקוחות — מעבר להחזר נסיעות רגיל צריך להסדיר החזר נסיעות בתפקיד (קילומטראז'/דלק).",
        steps: `1. הסדירו החזר נסיעות רגיל לעבודה וממנה (עד התקרה בצו)
2. **נסיעות בתפקיד** (בין לקוחות/אתרים): קבעו שיטת החזר — קילומטראז' לפי תעריף מקובל או החזר דלק לפי קבלות
3. דרשו מהעובדים דיווח נסיעות (אפשר לשלב עם אפליקציית הנוכחות בשטח)
4. תעדו הכל — זו גם הוצאה מוכרת לעסק`,
      },
    ],
    official_links: [
      { label: "החזר הוצאות נסיעה — כל-זכות", url: "https://www.kolzchut.org.il/he/החזר_הוצאות_נסיעה" },
    ],
    docs_needed: [],
    est_cost: "לפי עלות הנסיעה",
    est_time: "שוטף",
    applies_when: { plans_employees: true },
    depends_on: ["payroll-solution"],
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/החזר_הוצאות_נסיעה",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },
  {
    id: "employee-rights-basics",
    category_id: "employment",
    title: "זכויות עובד בסיסיות — חופשה, מחלה, הבראה",
    why: "מעסיק חייב לספק ולתעד ימי חופשה, דמי מחלה, דמי הבראה ותשלום שעות נוספות. אי-עמידה = תביעות והפרשי שכר רטרואקטיביים.",
    steps: `1. הכירו את מכסות החובה: ימי חופשה שנתית לפי ותק, ימי מחלה, דמי הבראה (אחרי שנה), ותעריפי שעות נוספות (125%/150%)
2. ודאו שהתלוש מציג צבירת חופשה ומחלה
3. שמרו נוהל אחיד לאישור חופשות והיעדרויות
4. עדכנו מכסות עם עליית הוותק`,
    official_links: [
      { label: "זכויות עובדים — כל-זכות", url: "https://www.kolzchut.org.il/he/זכויות_עובדים_ומעסיקים" },
    ],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעתיים ללמידה והטמעה",
    applies_when: { plans_employees: true },
    depends_on: ["payroll-solution"],
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/זכויות_עובדים_ומעסיקים",
    last_reviewed: REVIEWED,
    sort_order: 8,
  },
];
