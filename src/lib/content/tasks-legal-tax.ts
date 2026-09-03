import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-09-03";

export const LEGAL_TAX_TASKS: TaskTemplate[] = [
  // ============ הקמה ורישום ============
  {
    id: "open-vat-file",
    category_id: "legal-setup",
    pitfalls: [
      "לפתוח כעוסק פטור עסק שממילא חייב מורשה (כמה מקצועות חייבים מורשה ללא קשר למחזור) — ואז לתקן רטרואקטיבית.",
      "לחשוב ש\"פטור\" = פטור מהכול. עדיין חייבים דיווח שנתי, ניהול ספרים ותשלומי ביטוח לאומי ומקדמות.",
      "לא לשמור את תעודת העוסק — תצטרכו אותה מול הבנק, הסליקה והלקוחות.",
    ],
    title: "פתיחת תיק עוסק במע\"מ",
    why: "בלי תיק במע\"מ אסור להתחיל לפעול או להוציא חשבוניות. זה הצעד הראשון והחשוב ביותר — והוא חינם.",
    steps: `1. ודאו שבחרתם נכון בין עוסק פטור (מחזור עד ₪122,833 בשנת 2026) לעוסק מורשה
2. **עוסק פטור:** מלאו את הבקשה המקוונת באתר רשות המסים — התהליך פותח תיק גם במס הכנסה, וההודעה עוברת אוטומטית לביטוח לאומי
3. **עוסק מורשה:** מלאו טופס 821 באזור האישי באתר רשות המסים
4. הכינו מראש: תעודת זהות, אסמכתת חשבון בנק, ופרטים על העסק (כתובת, תחום, צפי מחזור)
5. שמרו את תעודת העוסק שתקבלו — תצטרכו אותה מול הבנק ולקוחות`,
    official_links: [
      { label: "פתיחת תיק עוסק פטור אונליין — רשות המסים", url: "https://www.gov.il/he/service/request-open-exempt-dealer-via-internet" },
      { label: "פתיחת תיק עוסק מורשה (טופס 821)", url: "https://www.gov.il/he/service/vat-821" },
      { label: "עוסק פטור — כל-זכות", url: "https://www.kolzchut.org.il/he/עוסק_פטור" },
    ],
    docs_needed: ["תעודת זהות", "אסמכתא על חשבון בנק (צ'ק מבוטל או אישור ניהול חשבון)", "פרטי העסק: כתובת, תחום פעילות, צפי מחזור"],
    est_cost: "חינם",
    est_time: "כשעה אונליין",
    completion: {
      confirm: "פתחתי את התיק במע\"מ וקיבלתי אישור",
      fields: [
        {
          key: "dealer_number",
          label: "מספר העוסק שקיבלת",
          placeholder: "9 ספרות",
          required: true,
          writesTo: "dealer_number",
        },
        { key: "vat_file", label: "מספר תיק מע\"מ (אם שונה)", writesTo: "vat_file" },
      ],
    },
    applies_when: {},
    depends_on: [],
    deadline_days: 0,
    priority: "critical",
    source_url: "https://www.gov.il/he/service/request-open-exempt-dealer-via-internet",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "open-income-tax-file",
    category_id: "legal-setup",
    pitfalls: [
      "להניח שהתיק נפתח אוטומטית ולא לבדוק — בפתיחת עוסק פטור מקוונת הוא נפתח יחד, אבל חובה לוודא באזור האישי.",
      "לא לשמור את מספר התיק — תזדקקו לו לכל דיווח ולכל פנייה לרשות.",
    ],
    title: "פתיחת תיק במס הכנסה",
    why: "כל עוסק חייב בתיק מס הכנסה. אם פתחתם עוסק פטור אונליין — התיק נפתח באותו תהליך; חשוב רק לוודא שזה קרה.",
    steps: `1. אם פתחתם תיק עוסק פטור בתהליך המקוון — תיק מס ההכנסה נפתח יחד איתו; בדקו באזור האישי שקיבלתם אישור
2. עוסק מורשה: פתיחת התיק נעשית יחד עם טופס 821 או באמצעות רו"ח
3. שמרו את מספר התיק — תזדקקו לו לכל דיווח
4. בדקו אם נקבעו לכם מקדמות מס (ראו משימה נפרדת)`,
    official_links: [
      { label: "פתיחת תיק עוסק במס הכנסה — כל-זכות", url: "https://www.kolzchut.org.il/he/פתיחת_תיק_עוסק_במס_הכנסה" },
    ],
    docs_needed: ["תעודת זהות"],
    est_cost: "חינם",
    est_time: "נכלל בתהליך פתיחת העוסק",
    completion: {
      confirm: "יש לי תיק פעיל במס הכנסה",
      fields: [
        {
          key: "income_tax_file",
          label: "מספר תיק מס הכנסה",
          required: true,
          writesTo: "income_tax_file",
        },
      ],
    },
    applies_when: {},
    depends_on: ["open-vat-file"],
    deadline_days: 7,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/פתיחת_תיק_עוסק_במס_הכנסה",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "open-bituach-leumi-file",
    category_id: "legal-setup",
    pitfalls: [
      "לדחות את הרישום — אי-רישום שולל זכויות (דמי לידה, פגיעה בעבודה) ויוצר חוב רטרואקטיבי בריבית.",
      "לא לעדכן את גובה המקדמות כשההכנסה משתנה — או שתשלמו יותר מדי, או שתצברו חוב.",
      "להתבלבל בין \"עצמאי העונה להגדרה\" ל\"מי שאינו עונה להגדרה\" — זה משפיע ישירות על הכיסוי הביטוחי.",
    ],
    title: "פתיחת תיק עצמאי בביטוח לאומי",
    why: "קובע את זכויותיך: דמי לידה, פגיעה בעבודה, אבטלה חלקית. אי-רישום עלול לשלול זכויות ולצבור חוב רטרואקטיבי.",
    steps: `1. אם פתחתם עוסק פטור אונליין וסימנתם פתיחת תיק בביטוח לאומי — הבקשה הועברה אוטומטית; ודאו באזור האישי של ביטוח לאומי
2. אחרת: מלאו טופס 6101 (דין וחשבון רב שנתי) באתר ביטוח לאומי
3. שימו לב להגדרת "עצמאי העונה להגדרה" — משפיעה על החיוב בדמי ביטוח
4. בדקו את גובה המקדמות החודשיות שנקבעו לכם והתאימו אותן להכנסה הצפויה`,
    official_links: [
      { label: "רישום עצמאי — ביטוח לאומי", url: "https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/howtoregister.aspx" },
      { label: "פתיחת תיק עצמאי בביטוח לאומי — כל-זכות", url: "https://www.kolzchut.org.il/he/פתיחת_תיק_עוסק_עצמאי_במוסד_לביטוח_לאומי" },
    ],
    docs_needed: ["תעודת זהות", "הערכת הכנסה שנתית"],
    est_cost: "חינם (המקדמות עצמן תלויות בהכנסה)",
    est_time: "30–60 דקות",
    completion: {
      confirm: "נרשמתי כעצמאי בביטוח לאומי",
      fields: [
        {
          key: "bituach_leumi_file",
          label: "מספר תיק בביטוח לאומי",
          required: true,
          writesTo: "bituach_leumi_file",
        },
        { key: "advance", label: "גובה המקדמה החודשית שנקבעה (₪)" },
      ],
    },
    applies_when: {},
    depends_on: ["open-vat-file"],
    deadline_days: 14,
    priority: "critical",
    source_url: "https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/howtoregister.aspx",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "business-license",
    category_id: "legal-setup",
    pitfalls: [
      "להתחיל לפעול בלי לבדוק — פעילות בלי רישיון נדרש היא עבירה פלילית שחושפת לקנסות ולסגירת העסק.",
      "להניח שעסק מהבית פטור — גם עסק מהבית יכול להיות טעון רישוי; בדקו ב\"צו החכם\" ומול הרשות.",
      "לא לבקש תשובה בכתב מהרשות — כך יש לכם אסמכתא אם נשאלים.",
    ],
    title: "בדיקת חובת רישיון עסק ברשות המקומית",
    why: "עסקים בתחומי מזון, טיפולים, ועסקים עם קבלת קהל עשויים להיות טעוני רישוי. פעילות בלי רישיון נדרש היא עבירה פלילית וחושפת לקנסות וסגירה.",
    steps: `1. בדקו ב"צו החכם" של משרד הפנים (קישור למטה) אם סוג העסק שלכם מופיע ברשימת העסקים טעוני הרישוי — מזון, קוסמטיקה ומספרות, חדרי כושר ועוד
2. גם אם לא מצאתם — התקשרו למחלקת רישוי עסקים ברשות המקומית, תארו את הפעילות ובקשו תשובה בכתב. גם עסק מהבית יכול להיות טעון רישוי
3. אם נדרש רישיון: הגישו בקשה מקוונת (קישור למטה) או ברשות; ייתכנו דרישות מכבאות, משרד הבריאות או איכות הסביבה
4. עד קבלת הרישיון בדקו אם אפשר לקבל היתר מזורז — הרפורמה ברישוי מאפשרת זאת לחלק מהעסקים
5. שמרו את הרישיון, תייקו אותו בארכיון, והציגו בבית העסק כנדרש`,
    official_links: [
      { label: "הצו החכם — בדיקה אם העסק טעון רישוי", url: "https://www.gov.il/he/departments/dynamiccollectors/add-zav-rishuy" },
      { label: "בקשה לרישיון עסק — משרד הפנים", url: "https://www.gov.il/he/service/application-for-new-business-license" },
      { label: "רישיון עסק — כל-זכות", url: "https://www.kolzchut.org.il/he/רישיון_עסק" },
    ],
    docs_needed: ["פרטי בית העסק", "תכנית העסק (לעסקים פיזיים)"],
    est_cost: "אגרה של כמה מאות שקלים (משתנה לפי רשות)",
    est_time: "שבועות עד חודשים — להתחיל מוקדם",
    completion: {
      confirm: "בירורתי מול הרשות המקומית וטיפלתי במה שנדרש",
      fields: [
        {
          key: "outcome",
          label: "מה התשובה שקיבלת?",
          placeholder: "למשל: לא טעון רישוי / רישיון התקבל / בקשה בטיפול",
          required: true,
        },
        { key: "authority", label: "הרשות המקומית" },
      ],
    },
    applies_when: { field: ["beauty_care", "food", "construction"] },
    depends_on: [],
    deadline_days: 14,
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/רישיון_עסק",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "professional-certification",
    category_id: "legal-setup",
    title: "הסדרת רישיון או הסמכה מקצועית",
    why: "בתחומים כמו קוסמטיקה, מזון וחשמל נדרשת הסמכה או תעודה כדי לעבוד כחוק — וגם הביטוח המקצועי מותנה בה.",
    steps: `1. בדקו אם המקצוע שלכם דורש רישיון/תעודה (משרד הבריאות, משרד העבודה וכו')
2. ודאו שהתעודות שלכם בתוקף ותייקו אותן בארכיון המסמכים
3. בדקו דרישות המשך — ריענון או השתלמויות תקופתיות
4. ציינו את ההסמכה בחומרי השיווק — זה יתרון מכירתי`,
    official_links: [
      { label: "מאגר בעלי מקצוע מורשים — משרד הבריאות", url: "https://practitioners.health.gov.il/" },
      { label: "רישיון עסק — כל-זכות", url: "https://www.kolzchut.org.il/he/רישיון_עסק" },
    ],
    docs_needed: ["תעודות והסמכות קיימות"],
    est_time: "תלוי בתחום",
    applies_when: { field: ["beauty_care", "food", "construction"] },
    depends_on: [],
    priority: "important",
    source_url: "https://practitioners.health.gov.il/",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "business-name-check",
    category_id: "legal-setup",
    title: "בדיקת שם העסק וסימן מסחר",
    why: "שם שכבר תפוס — משפטית או בגוגל — יעלה ביוקר אחר כך: מיתוג מחדש, אובדן לקוחות ואפילו תביעה.",
    steps: `1. חפשו את השם בגוגל וברשתות — האם עסק אחר בתחום כבר משתמש בו?
2. בדקו במאגר סימני המסחר של רשות הפטנטים שהשם לא רשום בתחומכם
3. בדקו שהדומיין ושמות המשתמש ברשתות פנויים
4. שקלו רישום סימן מסחר משלכם כשהעסק יתבסס`,
    official_links: [
      { label: "חיפוש סימני מסחר — רשות הפטנטים", url: "https://www.gov.il/he/departments/israel_patent_office" },
    ],
    docs_needed: [],
    est_cost: "הבדיקה חינם; רישום סימן מסחר מכ-₪1,600",
    est_time: "שעה",
    applies_when: {},
    depends_on: [],
    priority: "recommended",
    source_url: "https://www.gov.il/he/departments/israel_patent_office",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },

  // ============ מיסים והנהלת חשבונות ============
  {
    id: "choose-accountant",
    category_id: "tax",
    pitfalls: [
      "לבחור לפי מחיר בלבד — חשוב לסכם בכתב מה כלול (דיווחים? דוח שנתי? ייצוג מול רשויות?).",
      "עוסק מורשה שמנסה לנהל לבד דיווחי מע\"מ ומקדמות — טעויות עולות יותר משכר הטרחה.",
    ],
    title: "החלטה: רו\"ח, יועץ מס או ניהול עצמי",
    why: "עוסק פטור פשוט יכול להסתדר לבד; עוסק מורשה כמעט תמיד ירוויח מליווי מקצועי שחוסך טעויות יקרות ומס מיותר.",
    steps: `1. עוסק פטור עם הכנסות פשוטות: אפשר לנהל עצמאית עם תוכנת חשבוניות
2. עוסק מורשה: מומלץ רו"ח או יועץ מס לדיווחי מע"מ ומקדמות (עלות שוטפת: כ-₪150–₪500 לחודש לעצמאי)
3. בקשו המלצות מבעלי עסקים בתחומכם וראיינו 2–3 אנשי מקצוע
4. סכמו בכתב: מה כלול (דיווחים? דוח שנתי? ייצוג מול רשויות?) וכמה זה עולה
5. תייקו את פרטי איש המקצוע בכרטיס העסק`,
    official_links: [],
    docs_needed: [],
    est_cost: "₪0 (עצמאי) עד ₪500/חודש",
    est_time: "שבוע לבחירה",
    completion: {
      confirm: "החלטתי איך אני מנהל/ת את הספרים",
      fields: [
        {
          key: "accountant_name",
          label: "שם הרו\"ח / יועץ המס (או 'ניהול עצמי')",
          required: true,
          writesTo: "accountant_name",
        },
        { key: "accountant_phone", label: "טלפון", writesTo: "accountant_phone" },
      ],
    },
    applies_when: {},
    depends_on: [],
    deadline_days: 30,
    priority: "important",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "invoicing-software",
    category_id: "tax",
    pitfalls: [
      "עוסק מורשה שלא חיבר את התוכנה למערכת \"חשבוניות ישראל\" — הלקוח לא יוכל לקזז מע\"מ על חשבונית מעל ₪5,000 (לפני מע\"מ, מיוני 2026).",
      "עוסק פטור שמוציא \"חשבונית מס\" במקום קבלה — עוסק פטור אינו רשאי לגבות מע\"מ ואינו מוציא חשבונית מס.",
      "לבחור תוכנה לא מורשית / לא לשמור עותקים — מסמכים חייבים להיות ניתנים להפקה מחדש ולשמירה 7 שנים.",
    ],
    title: "תוכנת חשבוניות מורשית + חיבור לחשבוניות ישראל",
    why: "הוצאת מסמכים כדין היא חובה. עוסק מורשה שמוציא חשבוניות מעל הסף חייב מספר הקצאה מרשות המסים — בלעדיו הלקוח לא יקבל החזר מע\"מ.",
    steps: `1. בחרו תוכנת חשבוניות מורשית (יש כמה שירותים ישראליים מוכרים עם מסלול חינמי לעסקים קטנים)
2. עוסק פטור מוציא **קבלות** בלבד; עוסק מורשה מוציא חשבוניות מס
3. **מורשה:** הפעילו בתוכנה את החיבור למערכת "חשבוניות ישראל" — מיוני 2026 כל חשבונית מעל ₪5,000 (לפני מע"מ) חייבת מספר הקצאה
4. הגדירו לוגו ופרטי עסק בתבנית המסמכים
5. הוציאו מסמך בדיקה וודאו שהמספור תקין`,
    official_links: [
      { label: "מספר הקצאה לחשבונית מס — רשות המסים", url: "https://www.gov.il/he/service/request-assignment-number-for-tax-invoice" },
    ],
    docs_needed: ["תעודת עוסק"],
    est_cost: "חינם עד כ-₪50/חודש",
    est_time: "שעה",
    completion: {
      confirm: "יש לי תוכנת חשבוניות פעילה והוצאתי מסמך בדיקה",
      fields: [
        { key: "software", label: "שם התוכנה", required: true },
        {
          key: "allocation",
          label: "חיברת למערכת חשבוניות ישראל? (מורשה)",
          placeholder: "כן / לא רלוונטי לי",
        },
      ],
    },
    applies_when: {},
    depends_on: ["open-vat-file"],
    deadline_days: 21,
    priority: "critical",
    source_url: "https://www.gov.il/he/service/request-assignment-number-for-tax-invoice",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "bookkeeping",
    category_id: "tax",
    pitfalls: [
      "לזרוק קבלות של הוצאות — כל חשבונית/קבלה (דלק, ציוד, תוכנות) מקטינה מס; בלעדיה ההוצאה אובדת.",
      "לא לשמור מסמכים 7 שנים — זו חובה חוקית; מחיקה מוקדמת חושפת לקנסות ולשומות מנופחות.",
      "לערבב הוצאות עסקיות ופרטיות בלי תיעוד — מקשה על החישוב ועל הצהרת ההון.",
    ],
    title: "ניהול ספרים כדין",
    why: "החוק מחייב לתעד כל הכנסה והוצאה ולשמור מסמכים 7 שנים. ספרים לא תקינים = קנסות ושומות מס מנופחות.",
    steps: `1. שמרו כל חשבונית וקבלה — גם של הוצאות (דלק, ציוד, תוכנות, השתלמויות)
2. הפרידו הוצאות עסקיות מפרטיות; במעורבות (רכב, בית) — שמרו הכל ותנו לאיש המקצוע לחשב את החלק המוכר
3. סרקו מסמכים פיזיים ותייקו בארכיון המסמכים של BizReady
4. אחת לחודש: חצי שעה של סדר — לתייק, לסכם, לוודא שלא חסר כלום
5. שמרו הכל 7 שנים לפחות`,
    official_links: [
      { label: "ניהול ספרים — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
    ],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "חצי שעה בחודש",
    applies_when: {},
    depends_on: ["open-vat-file"],
    deadline_days: 30,
    recurrence: "monthly",
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/israel_tax_authority",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "income-tax-advances",
    category_id: "tax",
    pitfalls: [
      "לא לבקש הקטנת מקדמות כשההכנסה בפועל נמוכה מהצפי — כסף שלכם נשאר תקוע אצל המדינה עד הדוח השנתי.",
      "להתעלם מהמקדמות ולצבור חוב שמתגלה כהפתעה בסוף השנה, בתוספת ריבית והצמדה.",
    ],
    title: "הסדרת מקדמות מס הכנסה",
    why: "מס הכנסה גובה מקדמות חודשיות/דו-חודשיות על חשבון המס השנתי. מקדמות לא מותאמות = חוב מפתיע או כסף תקוע אצל המדינה.",
    steps: `1. בדקו באזור האישי ברשות המסים איזה שיעור מקדמות נקבע לכם
2. השוו לרווח בפועל — אם ההכנסה נמוכה מהצפי, אפשר לבקש הקטנת מקדמות
3. שלמו בזמן דרך האתר — איחור צובר ריבית והצמדה
4. בסוף השנה המקדמות מתקזזות מול המס בדוח השנתי`,
    official_links: [
      { label: "מקדמות מס הכנסה — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
    ],
    docs_needed: [],
    est_time: "חצי שעה",
    applies_when: {},
    depends_on: ["open-income-tax-file"],
    recurrence: "bimonthly",
    priority: "important",
    source_url: "https://www.gov.il/he/departments/israel_tax_authority",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "vat-reporting",
    category_id: "tax",
    pitfalls: [
      "לא לדווח בחודש בלי פעילות — גם דיווח \"אפס\" הוא חובה, ואי-הגשה גוררת קנס אוטומטי.",
      "לפספס את ה-15 (מקוון עד ה-19) — האיחור צובר קנס וריבית מיד.",
      "לשכוח לקזז תשומות (מע\"מ על הוצאות עם חשבונית מס) — כסף שמגיע לכם חזרה ואובד.",
    ],
    title: "דיווחי מע\"מ תקופתיים",
    why: "עוסק מורשה חייב לדווח ולשלם מע\"מ כל חודש או חודשיים. איחור גורר קנסות אוטומטיים.",
    steps: `1. בדקו את תדירות הדיווח שנקבעה לכם (חודשי/דו-חודשי, לפי גובה המחזור)
2. הדיווח נעשה אונליין עד ה-15 (דיווח מקוון: עד ה-19) בחודש העוקב
3. מדווחים: עסקאות (מכירות), תשומות (הוצאות עם חשבוניות מס) — וההפרש לתשלום או להחזר
4. אם יש רו"ח — ודאו שהוא מקבל מכם את המסמכים בזמן
5. גם בחודש בלי פעילות חובה לדווח (דיווח אפס)`,
    official_links: [
      { label: "דיווח מע\"מ — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
    ],
    docs_needed: ["חשבוניות עסקאות ותשומות לתקופה"],
    est_time: "שעה בכל תקופה",
    applies_when: { entity_type: ["osek_murshe"] },
    depends_on: ["open-vat-file"],
    deadline_days: 45,
    recurrence: "bimonthly",
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/israel_tax_authority",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "annual-tax-report",
    category_id: "tax",
    pitfalls: [
      "לא לצרף אישורי הפקדה לפנסיה ולקרן השתלמות — מפספסים החזר מס משמעותי שמגיע לכם.",
      "לא לבדוק זכאות ל\"עסק זעיר\" (מחזור עד ₪122,833) — ניכוי הוצאות אוטומטי של 30% בלי צורך בקבלות.",
      "להגיש לבד כשהמצב מורכב — לרוב שווה רו\"ח; טעות בדוח יקרה יותר מהשכר טרחה.",
    ],
    title: "דוח שנתי למס הכנסה",
    why: "כל עצמאי מגיש דוח שנתי על הכנסות והוצאות. זה גם המקום לקבל החזרי מס על הפקדות לפנסיה וקרן השתלמות.",
    steps: `1. מועד ההגשה: עד 30 באפריל (מקוון: עד סוף מאי) בשנה העוקבת; עם ייצוג רו"ח יש ארכות
2. רכזו: סיכום הכנסות, הוצאות מוכרות, אישורי הפקדה לפנסיה/השתלמות, אישורי ניכוי מס במקור
3. עצמאים מגישים בטופס 1301 המקוון
4. בדקו זכאות ל"עסק זעיר" (מחזור עד ₪122,833) — ניכוי הוצאות אוטומטי של 30% בלי קבלות
5. שמרו את שידור הדוח והאישור בארכיון`,
    official_links: [
      { label: "דוח שנתי לעצמאים — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
      { label: "עסק זעיר — כל-זכות", url: "https://www.kolzchut.org.il/he/עסק_זעיר" },
    ],
    docs_needed: ["ריכוז הכנסות והוצאות", "אישורי הפקדות פנסיוניות", "אישורי ניכוי מס במקור"],
    est_time: "כמה שעות (או דרך רו\"ח)",
    applies_when: {},
    depends_on: ["open-income-tax-file"],
    deadline_days: 365,
    recurrence: "yearly",
    priority: "critical",
    source_url: "https://www.kolzchut.org.il/he/עסק_זעיר",
    last_reviewed: REVIEWED,
    sort_order: 6,
  },
  {
    id: "withholding-certificate",
    category_id: "tax",
    pitfalls: [
      "לא לשלוח אישור ניכוי מס במקור ללקוחות עסקיים — בלי אישור תקף הם ינכו מס ותקבלו פחות כסף.",
      "לתת לאישור לפוג — יש לחדש מדי שנה (בדרך כלל סוף מרץ).",
    ],
    title: "אישור ניהול ספרים וניכוי מס במקור",
    why: "לקוחות עסקיים חייבים לנכות מס מהתשלום אליך אם אין לך אישור. בלי אישור תקף תקבל פחות כסף בכל עסקה.",
    steps: `1. הורידו את האישורים מהאזור האישי באתר רשות המסים (מופקים אוטומטית לעוסק חדש ותקין)
2. בדקו את שיעור הניכוי שנקבע — עוסק חדש מתחיל לרוב עם שיעור גבוה שיורד עם הזמן
3. שלחו את האישור ללקוחות עסקיים לפני התשלום הראשון
4. חדשו מדי שנה (בדרך כלל בסוף מרץ) ותייקו בארכיון`,
    official_links: [
      { label: "אישורי ניכוי מס במקור — רשות המסים", url: "https://www.gov.il/he/service/itc" },
    ],
    docs_needed: [],
    est_cost: "חינם",
    est_time: "רבע שעה",
    applies_when: { client_type: ["business", "both"] },
    depends_on: ["open-income-tax-file"],
    deadline_days: 30,
    recurrence: "yearly",
    priority: "important",
    source_url: "https://www.gov.il/he/service/itc",
    last_reviewed: REVIEWED,
    sort_order: 7,
  },
  {
    id: "patur-ceiling-watch",
    category_id: "tax",
    pitfalls: [
      "לחצות את התקרה בלי לשים לב — חיוב מע\"מ רטרואקטיבי על כל הסכום שמעל התקרה.",
      "לחכות לרגע האחרון — המעבר לעוסק מורשה לוקח זמן; מומלץ להתחיל לתכנן סביב 80% מהתקרה.",
    ],
    title: "מעקב אחרי תקרת עוסק פטור",
    why: "חציית התקרה (₪122,833 ב-2026) בלי מעבר לעוסק מורשה גוררת חיוב מע\"מ רטרואקטיבי על כל מה שמעליה.",
    steps: `1. עקבו אחרי המחזור המצטבר שלכם אחת לחודש
2. בסביבות 80% מהתקרה — התחילו לתכנן מעבר לעוסק מורשה עם איש מקצוע
3. חציית התקרה מחייבת רישום כמורשה ותשלום מע"מ על החלק שמעל
4. זכרו: התקרה מתעדכנת כל ינואר — בדקו את הסכום העדכני`,
    official_links: [
      { label: "עוסק פטור — כל-זכות", url: "https://www.kolzchut.org.il/he/עוסק_פטור" },
    ],
    docs_needed: [],
    est_time: "5 דקות בחודש",
    applies_when: { entity_type: ["osek_patur"] },
    depends_on: ["open-vat-file"],
    recurrence: "monthly",
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/עוסק_פטור",
    last_reviewed: REVIEWED,
    sort_order: 8,
  },
  {
    id: "capital-statement-prep",
    category_id: "tax",
    title: "היערכות להצהרת הון",
    why: "רשות המסים תדרוש ממך בשלב כלשהו הצהרה על כל הנכסים וההתחייבויות. מי שלא שמר מסמכים מהיום הראשון — סובל.",
    steps: `1. הצהרת הון ראשונה מגיעה בדרך כלל שנה-שלוש אחרי פתיחת התיק
2. כבר עכשיו: שמרו אסמכתאות על נכסים קיימים (דירה, רכב, חסכונות, ירושות ומתנות גדולות)
3. תעדו העברות כספים גדולות בין חשבונות
4. כשתגיע הדרישה — 120 יום להגשה; אל תגישו לבד, זה המסמך שהכי כדאי לעשות עם רו"ח`,
    official_links: [
      { label: "הצהרת הון — כל-זכות", url: "https://www.kolzchut.org.il/he/הצהרת_הון" },
    ],
    docs_needed: ["אסמכתאות נכסים והתחייבויות"],
    est_time: "שעה של סדר עכשיו — חוסכת ימים בעתיד",
    applies_when: {},
    depends_on: ["open-income-tax-file"],
    priority: "recommended",
    source_url: "https://www.kolzchut.org.il/he/הצהרת_הון",
    last_reviewed: REVIEWED,
    sort_order: 9,
  },
];
