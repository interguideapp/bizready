import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-07-18";

export const DIGITAL_MARKETING_OPS_TASKS: TaskTemplate[] = [
  // ============ רגולציה דיגיטלית ============
  {
    id: "website-accessibility",
    category_id: "digital-regulation",
    title: "נגישות האתר — תקן ישראלי 5568",
    why: "אתרי עסקים בישראל נדרשים לנגישות לפי תקן 5568 (WCAG ברמת AA). אתר לא נגיש חושף לתביעות — נושא עם גל תביעות פעיל.",
    steps: `1. בדקו את מעמדכם: לעסקים קטנים יש פטורים תלויי-מחזור, אך גם עסק פטור חייב לפרסם דרכי התקשרות נגישות
2. הריצו בדיקת נגישות אוטומטית (יש כלים חינמיים) וטפלו בבסיס: ניגודיות, טקסט לתמונות, ניווט מקלדת
3. אם בונים אתר חדש — דרשו מהבונה עמידה בתקן מראש (זול פי כמה מתיקון בדיעבד)
4. שקלו רכיב נגישות ייעודי, אך זכרו שהוא לא פוטר לבדו מעמידה בתקן`,
    official_links: [
      { label: "נגישות אינטרנט — gov.il", url: "https://www.gov.il/he/departments/topics/internet_accessibility" },
      { label: "הנגשת אתרים ואפליקציות — כל-זכות", url: "https://www.kolzchut.org.il/he/הנגשת_אתרי_אינטרנט_ואפליקציות_לאנשים_עם_מוגבלות" },
      { label: "כל מה שצריך לדעת על תקנות הנגישות — איגוד האינטרנט", url: "https://www.isoc.org.il/freedom-of-internet/accessibility/all-about-accessibility" },
    ],
    docs_needed: [],
    est_cost: "מבדיקה חינמית עד אלפי ₪ להנגשה מלאה",
    est_time: "תלוי במצב האתר",
    applies_when: { has_website: true },
    depends_on: [],
    deadline_days: 60,
    priority: "critical",
    source_url: "https://www.isoc.org.il/freedom-of-internet/accessibility/all-about-accessibility",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "accessibility-statement",
    category_id: "digital-regulation",
    title: "הצהרת נגישות באתר",
    why: "פרסום הצהרת נגישות הוא חובה נפרדת מהנגשת האתר — והיא ההגנה הראשונה שלך מול תביעה.",
    steps: `1. כתבו עמוד "הצהרת נגישות": מה הונגש, מה עדיין לא, ופרטי רכז/איש קשר לנושאי נגישות
2. קשרו אליו מכל עמוד באתר (בדרך כלל בפוטר)
3. עדכנו את ההצהרה אחרי כל שינוי משמעותי באתר`,
    official_links: [
      { label: "הצהרת נגישות — איגוד האינטרנט", url: "https://www.isoc.org.il/freedom-of-internet/accessibility/all-about-accessibility" },
    ],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעה",
    applies_when: { has_website: true },
    depends_on: ["website-accessibility"],
    deadline_days: 60,
    priority: "important",
    source_url: "https://www.isoc.org.il/freedom-of-internet/accessibility/all-about-accessibility",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "spam-law-compliance",
    category_id: "digital-regulation",
    title: "עמידה בחוק הספאם — דיוור רק בהסכמה",
    why: "שליחת פרסומת בלי הסכמה מפורשת = עד ₪1,000 פיצוי לכל הודעה, בלי צורך להוכיח נזק. לקוחות תובעים על זה, והרבה.",
    steps: `1. שלחו דיוור פרסומי (SMS, מייל, וואטסאפ) רק למי שנתן הסכמה מפורשת ומתועדת — צ'קבוקס מסומן מראש לא נחשב
2. חריג: לקוח קיים שמסר פרטים בעת רכישה — מותר לשלוח על מוצרים דומים, אם ניתנה לו אפשרות סירוב
3. כל הודעה חייבת לכלול: המילה "פרסומת", זהות השולח, ודרך הסרה פשוטה וחינמית
4. תעדו הסכמות ושמרו רשימת מוסרים — והסירו מיד מי שביקש`,
    official_links: [
      { label: "שאלות ותשובות בנושא ספאם — משרד התקשורת", url: "https://www.gov.il/he/pages/17052018_7" },
    ],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעה להגדרת התהליך",
    applies_when: {},
    depends_on: [],
    deadline_days: 45,
    priority: "important",
    source_url: "https://www.gov.il/he/pages/17052018_7",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "database-registration-check",
    category_id: "digital-regulation",
    title: "בדיקת חובות מאגר מידע",
    why: "עסק שמנהל מאגר לקוחות — במיוחד עם מידע רגיש — כפוף לחובות אבטחה לפי תיקון 13, וייתכן שגם לרישום/יידוע לרשות.",
    steps: `1. בדקו מה אתם שומרים: רשימת לקוחות עם פרטי קשר היא כבר "מאגר מידע"
2. מידע רגיש (בריאות, מצב כלכלי) מחמיר את הדרישות — בדקו באתר הרשות אם חלה עליכם חובת רישום או יידוע
3. יישמו אבטחה בסיסית: סיסמאות חזקות, הרשאות מינימליות, אל תשמרו פרטים בקבצי אקסל פתוחים
4. מחקו מידע שאין בו עוד צורך`,
    official_links: [
      { label: "הרשות להגנת הפרטיות — מאגרי מידע", url: "https://www.gov.il/he/departments/the_privacy_protection_authority" },
    ],
    docs_needed: [],
    est_time: "שעה-שעתיים",
    applies_when: { collects_personal_data: true },
    depends_on: ["privacy-policy"],
    priority: "important",
    source_url: "https://www.gov.il/he/departments/the_privacy_protection_authority",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "cookies-banner",
    category_id: "digital-regulation",
    title: "שקיפות עוגיות ומעקב באתר",
    why: "אם האתר משתמש בפיקסלים ואנליטיקס, נדרשת שקיפות כלפי הגולשים — חלק מחובות היידוע שהתחזקו בתיקון 13.",
    steps: `1. מפו אילו כלי מעקב פועלים באתר (Google Analytics, פיקסל של מטא וכו')
2. הוסיפו באנר עוגיות שמיידע ומאפשר בחירה
3. פרטו את כלי המעקב במדיניות הפרטיות
4. אל תפעילו פיקסלים של שיווק לפני קבלת הסכמה`,
    official_links: [
      { label: "הרשות להגנת הפרטיות", url: "https://www.gov.il/he/departments/the_privacy_protection_authority" },
    ],
    docs_needed: [],
    est_cost: "יש פתרונות חינמיים",
    est_time: "שעה",
    applies_when: { has_website: true },
    depends_on: ["privacy-policy"],
    priority: "recommended",
    source_url: "https://www.gov.il/he/departments/the_privacy_protection_authority",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },

  // ============ נוכחות דיגיטלית ============
  {
    id: "buy-domain",
    category_id: "digital-presence",
    title: "רכישת דומיין לעסק",
    why: "דומיין משלך הוא הכתובת הקבועה של העסק — הבסיס לאתר ולמייל מקצועי. עולה כמו קפה בחודש.",
    steps: `1. בחרו שם דומיין: קצר (עד 15 תווים), קל להקלדה בעברית ובאנגלית, בלי מקפים אם אפשר, ותואם לשם העסק
2. בדקו זמינות: הקלידו את השם אצל אחד הרשמים המוסמכים — אם תפוס, נסו וריאציה (הוספת תחום: dana-nails, תחילית: get, סיומת אחרת)
3. בחרו סיומת: **.co.il** לעסק ישראלי (משדר מקומיות ואמינות, דורש רישום דרך רשם מוסמך של האיגוד) או **.com** לעסק בינלאומי. אפשר גם לרכוש את שתיהן ולהפנות אחת לשנייה
4. השוו מחירים בין רשמים — דומיין .co.il עולה בדרך כלל ₪50–₪90 לשנה; היזהרו ממחיר שנה ראשונה זול שקופץ בחידוש
5. בתהליך הרכישה: רשמו את הדומיין על השם והמייל **שלכם** (לא של בונה האתרים!) — כך הוא נשאר בבעלותכם גם אם תחליפו ספק
6. הפעילו חידוש אוטומטי + ודאו שכרטיס האשראי בתוקף — דומיין שפג תוקפו נחטף תוך ימים
7. תייקו בכרטיס העסק: שם הרשם, המייל של החשבון ותאריך החידוש`,
    official_links: [
      { label: "רשימת הרשמים המוסמכים ל-.il — איגוד האינטרנט", url: "https://www.isoc.org.il/domain-name-registry/accredited-registrars" },
      { label: "רישום דומיין חדש — איגוד האינטרנט", url: "https://www.isoc.org.il/domain-name-registry/manage-register-domain/register-new-domain" },
    ],
    docs_needed: [],
    est_cost: "כ-₪50–₪100 לשנה",
    est_time: "רבע שעה",
    applies_when: {},
    depends_on: ["business-name-check"],
    recurrence: "yearly",
    priority: "important",
    source_url: "https://www.isoc.org.il/domains",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "build-website",
    category_id: "digital-presence",
    title: "אתר או דף נחיתה",
    why: "לקוח שמחפש אותך ולא מוצא כלום — חושד. גם דף נחיתה פשוט עם שירותים, מחירים ויצירת קשר בונה אמון ומביא פניות.",
    steps: `1. התחילו קטן: דף נחיתה אחד טוב עדיף על אתר גדול שלא נגמר
2. חובה בדף: מה אתם עושים, למי, המחיר (או "החל מ-"), המלצות, וכפתור וואטסאפ/טופס ליצירת קשר
3. בחרו פלטפורמה פשוטה או בונה אתרים מקצועי — דרשו נגישות לפי תקן 5568 מראש
4. חברו את הדומיין שרכשתם
5. ודאו מובייל: רוב הגולשים שלכם יגיעו מהטלפון`,
    official_links: [],
    docs_needed: ["טקסטים על העסק", "תמונות", "לוגו"],
    est_cost: "מחינם (בונה עצמאי) עד אלפי ₪",
    est_time: "שבוע-חודש",
    applies_when: {},
    depends_on: ["buy-domain"],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "business-email",
    category_id: "digital-presence",
    title: "כתובת אימייל עסקית",
    why: "מייל מהדומיין שלך (name@business.co.il) נראה מקצועי פי כמה מ-gmail — ומרכז את כל תכתובת העסק במקום אחד.",
    steps: `1. בחרו פתרון: **Google Workspace** (כ-$6–7/חודש, הנוח ביותר — ג'ימייל עם הדומיין שלכם), **Microsoft 365**, או תיבה חינמית/זולה מספק הדומיין (מספיק להתחלה)
2. חברו את הדומיין: מוסיפים רשומות MX ו-SPF שהספק נותן, בממשק ניהול ה-DNS של הרשם — יש מדריך מובנה אצל כל ספק, לוקח כ-10 דקות
3. בחרו כתובת מקצועית: hello@ / info@ / השם הפרטי@ — קצר ובלי מספרים
4. הגדירו חתימת מייל אחידה: שם, שם העסק, טלפון, קישור לאתר ולוואטסאפ
5. הוסיפו גם רשומת DMARC בסיסית — משפרת עבירות (שהמיילים לא ייפלו לספאם)
6. מעכשיו: כל תקשורת עסקית מהכתובת הזו, והפרידו מהמייל הפרטי`,
    official_links: [],
    docs_needed: [],
    est_cost: "מחינם עד כ-₪25/חודש",
    est_time: "שעה",
    applies_when: {},
    depends_on: ["buy-domain"],
    priority: "recommended",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "google-business-profile",
    category_id: "digital-presence",
    title: "פרופיל עסק בגוגל (Google Business Profile)",
    why: "כשמחפשים אותך בגוגל או במפות — זה מה שמופיע. פרופיל מלא עם ביקורות הוא מקור הלקוחות החינמי החזק ביותר לעסק מקומי.",
    steps: `1. פתחו פרופיל בחינם ב-Google Business Profile ואמתו את הבעלות
2. מלאו הכל: קטגוריה מדויקת, שעות, טלפון, אתר, תמונות אמיתיות ואיכותיות
3. בקשו מכל לקוח מרוצה ביקורת — זה הגורם המשפיע ביותר על הדירוג
4. הגיבו לכל ביקורת, גם שלילית — בנימוס ובמקצועיות
5. עדכנו תמונות ופוסטים אחת לתקופה כדי להישאר פעילים`,
    official_links: [
      { label: "Google Business Profile", url: "https://www.google.com/business/" },
    ],
    docs_needed: ["פרטי העסק", "תמונות"],
    est_cost: "חינם",
    est_time: "שעה + אימות",
    applies_when: { work_location: ["home", "premises", "mobile"] },
    depends_on: [],
    priority: "critical",
    source_url: "https://www.google.com/business/",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "social-profiles",
    category_id: "digital-presence",
    title: "פרופיל עסקי ברשתות הרלוונטיות",
    why: "הלקוחות שלך כבר שם. עדיף נוכחות מצוינת ברשת אחת נכונה מנוכחות רדומה בחמש.",
    steps: `1. בחרו רשת אחת-שתיים לפי הקהל: אינסטגרם לעסקים ויזואליים, פייסבוק לקהילות מקומיות, לינקדאין ל-B2B, טיקטוק לקהל צעיר
2. פתחו פרופיל עסקי (לא פרטי) עם שם אחיד, לוגו ותיאור ברור + דרך יצירת קשר
3. העלו תוכן פתיחה: מי אתם, מה אתם עושים, דוגמאות עבודה
4. קבעו קצב ריאלי — עדיף פוסט איכותי בשבוע מהתפרצות ונטישה`,
    official_links: [],
    docs_needed: ["לוגו", "תמונות עבודה"],
    est_cost: "חינם",
    est_time: "שעתיים להקמה",
    applies_when: {},
    depends_on: [],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "whatsapp-business",
    category_id: "digital-presence",
    title: "WhatsApp Business",
    why: "בישראל, וואטסאפ הוא ערוץ המכירה האמיתי. הגרסה העסקית מוסיפה פרופיל עסק, מענה אוטומטי וקטלוג — בחינם.",
    steps: `1. הורידו את אפליקציית WhatsApp Business (אפשר על מספר נפרד מהפרטי)
2. מלאו פרופיל עסקי: שם, תחום, שעות פעילות, כתובת, קישור לאתר
3. הגדירו הודעת פתיחה אוטומטית והודעת "מחוץ לשעות הפעילות"
4. בנו קטלוג מוצרים/שירותים עם מחירים
5. הוסיפו קישור wa.me לאתר ולפרופילים ברשתות`,
    official_links: [
      { label: "WhatsApp Business", url: "https://business.whatsapp.com/" },
    ],
    docs_needed: ["לוגו", "רשימת שירותים ומחירים"],
    est_cost: "חינם",
    est_time: "שעה",
    applies_when: {},
    depends_on: [],
    priority: "important",
    source_url: "https://business.whatsapp.com/",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },

  // ============ שיווק ============
  {
    id: "target-audience",
    category_id: "marketing",
    title: "הגדרת קהל יעד ובידול",
    why: "\"כולם\" זה לא קהל יעד. עסק שיודע בדיוק למי הוא פונה ולמה דווקא הוא — מנצח בשיווק גם עם תקציב אפס.",
    steps: `1. תארו את הלקוח האידיאלי: מי, בן כמה, מה כואב לו, איפה הוא מחפש פתרונות
2. נסחו משפט בידול: "אני עוזר ל[קהל] להשיג [תוצאה] באמצעות [מה שמייחד אותך]"
3. בדקו את המשפט על 3 אנשים אמיתיים — הבינו אותו מיד?
4. השתמשו בו בכל מקום: אתר, רשתות, שיחות מכירה`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעתיים-שלוש",
    applies_when: {},
    depends_on: [],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "basic-branding",
    category_id: "marketing",
    title: "מיתוג בסיסי — שם, לוגו וצבעים",
    why: "מיתוג עקבי גורם לעסק להיראות מבוסס ואמין. לא צריך לוגו של אלפי שקלים — צריך מראה אחיד בכל נקודת מגע.",
    steps: `1. קבעו שפה: לוגו פשוט, 2–3 צבעים קבועים, פונט אחד-שניים — ורשמו לעצמכם את קודי הצבעים המדויקים
2. אפשרויות ללוגו: מעצב מקצועי (מאות עד אלפי ₪ — שווה כשיש תקציב), כלי עיצוב עצמאי כמו Canva (חינם-זול), או מעצב מתחיל מוכשר
3. בקשו מהמעצב את כל הפורמטים: PNG עם רקע שקוף, גרסה לרקע כהה, וקובץ מקור (SVG/AI)
4. **העלו את הלוגו כאן במערכת** (בקטע "הלוגו שלי" למטה) — הוא יישמר בפרופיל העסקי ותמיד יהיה זמין
5. יישמו בכל מקום בבת אחת: וואטסאפ, רשתות, חשבוניות, חתימת מייל — עקביות היא כל הסוד`,
    official_links: [],
    docs_needed: [],
    est_cost: "מחינם עד אלפי ₪",
    est_time: "שבוע",
    applies_when: {},
    depends_on: ["business-name-check"],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "marketing-plan",
    category_id: "marketing",
    title: "תכנית שיווק ראשונית",
    why: "בלי תכנית, שיווק הופך לפוסטים אקראיים כשנזכרים. תכנית פשוטה של עמוד אחד שווה יותר מאסטרטגיה שאף אחד לא מבצע.",
    steps: `1. בחרו 2 ערוצים מרכזיים לפי איפה שהקהל שלכם נמצא (גוגל, אינסטגרם, פה-לאוזן, שיתופי פעולה)
2. קבעו יעד חודשי מדיד: X פניות חדשות, Y פגישות
3. הקצו תקציב — גם ₪300 בחודש לקידום ממוקד יכול לעבוד
4. פעם בחודש: מה עבד? מה לא? התאימו
5. אל תזניחו את הזול והחזק: לבקש המלצות והפניות מלקוחות מרוצים`,
    official_links: [],
    docs_needed: [],
    est_cost: "לפי תקציב",
    est_time: "שעתיים לבנייה, שעה בחודש",
    applies_when: {},
    depends_on: ["target-audience"],
    recurrence: "monthly",
    priority: "recommended",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "reviews-mechanism",
    category_id: "marketing",
    title: "מנגנון איסוף ביקורות והמלצות",
    why: "לקוחות מאמינים ללקוחות. ביקורות בגוגל והמלצות אמיתיות הן הנכס השיווקי שעובד בשבילך 24/7 — בחינם.",
    steps: `1. קבעו רגע קבוע לבקשת ביקורת: מיד אחרי שירות מוצלח, כשהלקוח מרוצה
2. שלחו קישור ישיר לכתיבת ביקורת בגוגל — כמה שפחות קליקים
3. שמרו צילומי מסך של פידבקים טובים מוואטסאפ (באישור הלקוח) לשימוש ברשתות
4. הציבו יעד: ביקורת חדשה בכל שבוע-שבועיים`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "חצי שעה להקמה",
    applies_when: {},
    depends_on: ["google-business-profile"],
    priority: "recommended",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "digital-business-card",
    category_id: "marketing",
    title: "כרטיס ביקור דיגיטלי וחתימת מייל",
    why: "בסוף כל שיחה טובה מישהו שואל \"יש לך פרטים?\". תשובה מקצועית בקליק משאירה רושם וסוגרת מעגל.",
    steps: `1. צרו כרטיס דיגיטלי (דף קישורים או כרטיס ייעודי): שם, עסק, וואטסאפ, אתר, רשתות
2. שמרו את הקישור נגיש בטלפון לשיתוף מהיר
3. הגדירו חתימת מייל אחידה עם לוגו ופרטי קשר
4. שקלו גם כרטיס פיזי מינימלי אם אתם פוגשים לקוחות פנים-אל-פנים`,
    official_links: [],
    docs_needed: ["לוגו"],
    est_cost: "מחינם",
    est_time: "שעה",
    applies_when: {},
    depends_on: ["basic-branding"],
    priority: "recommended",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },

  // ============ תפעול ============
  {
    id: "pricing",
    category_id: "operations",
    title: "תמחור נכון של השירותים",
    why: "טעות התמחור הקלאסית: לשכוח שמהמחיר יורדים מס, ביטוח לאומי, פנסיה והוצאות. מחיר \"תחרותי\" מדי = לעבוד בחינם.",
    steps: `1. חשבו עלות אמיתית לשעה: חברו את כל ההוצאות החודשיות (תוכנות, ביטוחים, חומרים, נסיעות, מקדמות) וחלקו במספר שעות העבודה **בפועל** — זכרו ששיווק ואדמיניסטרציה לא מחויבים ללקוח
2. זכרו: מכל שקל הכנסה יורדים כ-30%–40% למסים, ביטוח לאומי ופנסיה — תמחרו ברוטו בהתאם
3. בדקו מחירי שוק: התקשרו כלקוח ל-3 מתחרים באזורכם ובנו טווח — ואל תהיו הכי זולים; תחרו על ערך, לא על מחיר
4. עוסק מורשה: החליטו אם המחיר כולל מע"מ והציגו זאת ברור בכל הצעה
5. **בנו את המחירון שלכם כאן במערכת** (בקטע "המחירון שלי" למטה) — כל שירות/מוצר עם מחיר. הוא יופיע גם בפרופיל העסקי שלכם
6. קבעו כללי הנחות מראש (למשל: 10% לחבילה מראש) — הנחה ספונטנית שוחקת רווח
7. עדכנו מחירון אחת לשנה לפחות, ותמיד כשעלויות עולות`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעתיים-שלוש",
    applies_when: {},
    depends_on: [],
    priority: "critical",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "sales-process",
    category_id: "operations",
    title: "תהליך מכירה מסודר",
    why: "תהליך אחיד — הצעת מחיר, אישור, ביצוע, חשבונית, גבייה — מונע לקוחות שנופלים בין הכיסאות וכסף שלא נגבה.",
    steps: `1. בנו תבנית הצעת מחיר: מה כלול, מחיר, תוקף ההצעה, תנאי תשלום
2. קבעו כלל: לא מתחילים עבודה בלי אישור בכתב (גם וואטסאפ נחשב)
3. הוציאו חשבונית/קבלה מיד עם התשלום — לא "בסוף החודש"
4. קבעו יום קבוע בשבוע למעקב גבייה אחרי חובות פתוחים
5. תעדו כל שלב בכלי ניהול הלקוחות`,
    official_links: [],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "שעתיים להקמה",
    applies_when: {},
    depends_on: ["invoicing-software", "pricing"],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "docs-backup",
    category_id: "operations",
    title: "גיבוי מסמכים וקבצים בענן",
    why: "מחשב שנגנב או קורס בלי גיבוי יכול למחוק שנים של חשבוניות, קבצי לקוחות ועבודות. גיבוי ענן פשוט פותר את זה.",
    steps: `1. פתחו תיקיית ענן ייעודית לעסק (Google Drive / Dropbox / OneDrive)
2. מבנה פשוט: חשבוניות / לקוחות / מסמכים רשמיים / שיווק
3. הפעילו סנכרון אוטומטי מהמחשב והטלפון
4. את המסמכים הרשמיים החשובים תייקו גם בארכיון של BizReady — כך הכל זמין בכל מקום`,
    official_links: [],
    docs_needed: [],
    est_cost: "מחינם עד כ-₪40/חודש",
    est_time: "שעה",
    applies_when: {},
    depends_on: [],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "crm-basic",
    category_id: "operations",
    title: "ניהול לקוחות בסיסי (CRM)",
    why: "לזכור מי פנה, מה סוכם ומתי לחזור — זה ההבדל בין עסק מקצועי לבלגן. לקוח שנשכח הוא הכנסה שאבדה.",
    steps: `1. התחילו פשוט: טבלה עם שם, טלפון, מקור ההגעה, סטטוס (פנה/הצעה/לקוח), והערות
2. עדכנו אחרי כל אינטראקציה — 30 שניות שחוסכות שכחה
3. סמנו למי צריך לחזור ומתי, ועברו על הרשימה פעם בשבוע
4. כשהעסק גדל — שדרגו ל-CRM ייעודי (יש חינמיים לעסקים קטנים)
5. זכרו: רשימת הלקוחות היא מאגר מידע — שמרו עליה מאובטחת`,
    official_links: [],
    docs_needed: [],
    est_cost: "מחינם",
    est_time: "שעה להקמה",
    applies_when: {},
    depends_on: [],
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "vehicle-expenses",
    category_id: "operations",
    title: "הכרה בהוצאות רכב",
    why: "אם הרכב משמש את העסק — חלק מהדלק, הביטוח והטיפולים מוכר כהוצאה ומקטין את המס. בלי תיעוד — ההטבה הולכת לאיבוד.",
    steps: `1. שמרו כל קבלה: דלק, ביטוח, טיפולים, אגרות, חניה
2. ההכרה היא חלקית (לפי כללי מס הכנסה לרכב מעורב) — איש המקצוע יחשב את החלק המוכר בדוח
3. רשמו את מד הק"מ בתחילת השנה ובסופה
4. נסיעות ספציפיות ללקוחות — תעדו ביומן`,
    official_links: [
      { label: "הוצאות מוכרות — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
    ],
    docs_needed: ["קבלות הוצאות רכב"],
    est_cost: "חינם",
    est_time: "שוטף",
    applies_when: { uses_vehicle: true },
    depends_on: ["bookkeeping"],
    priority: "recommended",
    source_url: "https://www.gov.il/he/departments/israel_tax_authority",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
];
