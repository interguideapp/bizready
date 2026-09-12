import type { TaskTemplate } from "@/lib/types";

const REVIEWED = "2026-09-09";

/**
 * חברה בע"מ ושותפות רשומה — the incorporated tracks.
 *
 * These only apply to entity_type "company" / "partnership". The individual
 * registration tasks (open-vat-file / open-income-tax-file / open-bituach-leumi-file)
 * are gated OUT of the company track, because a company opens its tax files as a
 * legal person (VAT is always מורשה, plus a ניכויים file), not as an עוסק.
 *
 * Statutory filings (vat-reporting / income-tax-advances) stay shared: they list
 * `company-tax-files` as an alternative prerequisite, so for a company they only
 * come due once the company's tax files are open — the same "one truth" gate the
 * osek track gets from `open-vat-file`.
 *
 * Amounts are written as {{figureKey}} tokens and resolved at render from
 * content/figures.ts, which carries the year and the official source for each
 * one. They used to be typed in here as literals under a comment claiming they
 * came from YEARLY_FIGURES — a constant this file never imported — so updating
 * the config changed nothing a user could see.
 */
export const ENTITY_TASKS: TaskTemplate[] = [
  // ============ חברה בע"מ ============
  {
    id: "register-company",
    category_id: "legal-setup",
    title: "רישום חברה בע\"מ ברשם החברות",
    why: "חברה מתחילה להתקיים רק אחרי רישום ברשם החברות. עד אז אין ישות משפטית, אין חשבון בנק על שם החברה ואי אפשר לפתוח תיקי מס.",
    after_submit:
      "בסיום מתקבלת תעודת התאגדות ומספר חברה (ח.פ.) בן 9 ספרות. שמרו את התעודה, התקנון והפרוטוקולים — תצטרכו אותם לפתיחת חשבון הבנק ולפתיחת תיקי המס. שנה אחרי הרישום מתחילה חובת האגרה השנתית לרשם.",
    pitfalls: [
      "לפתוח חברה כשעצמאי (עוסק) מספיק — לחברה יש עלויות קבועות (רו\"ח, אגרה שנתית, דוחות מבוקרים). שווה לבדוק עם איש מקצוע אם באמת צריך.",
      "לנסח תקנון גנרי בלי להגדיר בעלי מניות, הון וזכויות — מקור לסכסוכים. עדיף תקנון מותאם דרך עו\"ד.",
      "לשכוח שמנהל בחברה הוא נושא משרה עם חובות אישיות — לא רק 'בעלים'.",
    ],
    steps: `1. בחרו שם חברה פנוי (בדיקה באתר רשם החברות) והחליטו על בעלי המניות והון המניות
2. הכינו: תקנון חברה, טופס הגשה (טופס 1), הצהרת בעלי מניות והצהרת דירקטורים ראשונים
3. הגישו את הבקשה — מקוונת זולה יותר (כ-{{companyRegistrationFeeOnline}} לעומת {{companyRegistrationFee}} בהגשה רגילה)
4. רוב האנשים עושים את השלב הזה דרך עו"ד (החל מכמה מאות ש"ח) כדי לוודא תקנון תקין
5. שמרו את תעודת ההתאגדות ומספר הח.פ. שתקבלו`,
    official_links: [
      { label: "רישום חברה — רשות התאגידים", url: "https://www.gov.il/he/service/company_registration" },
      { label: "פתיחת חברה — כל-זכות", url: "https://www.kolzchut.org.il/he/רישום_חברה_פרטית" },
    ],
    docs_needed: ["תעודות זהות של בעלי המניות והדירקטורים", "תקנון חברה", "החלטה על שם והון מניות"],
    est_cost: "{{companyRegistrationFeeOnline}} מקוון ({{companyRegistrationFee}} רגיל) + שכ\"ט עו\"ד",
    est_time: "כמה ימי עסקים",
    completion: {
      confirm: "החברה נרשמה וקיבלתי מספר ח.פ.",
      fields: [
        { key: "dealer_number", label: "מספר החברה (ח.פ.)", placeholder: "9 ספרות", required: true, writesTo: "dealer_number" },
      ],
    },
    applies_when: { entity_type: ["company"] },
    depends_on: [],
    deadline_days: 0,
    priority: "critical",
    source_url: "https://www.gov.il/he/service/company_registration",
    last_reviewed: REVIEWED,
    sort_order: 1,
  },
  {
    id: "company-tax-files",
    category_id: "legal-setup",
    title: "פתיחת תיקי מס לחברה (מע\"מ, מס הכנסה, ניכויים)",
    why: "החברה חייבת בתיק מע\"מ (כעוסק מורשה — לחברה אין מסלול 'פטור'), תיק מס הכנסה, ותיק ניכויים אם תעסיק עובדים או תמשוך משכורת. בלי אלה אסור להוציא חשבוניות.",
    after_submit:
      "מכאן נפתחת חובת דיווח מע\"מ תקופתי ומקדמות מס הכנסה — בדיוק כמו עוסק מורשה. אם פתחתם תיק ניכויים, נפתחת גם חובת דיווח ותשלום ניכויים חודשי על שכר.",
    pitfalls: [
      "לחשוב שרישום ברשם החברות פותח אוטומטית את תיקי המס — לא. זה שלב נפרד מול רשות המסים.",
      "לשכוח את תיק הניכויים — ברגע שמושכים משכורת או מעסיקים, חובה.",
      "להוציא חשבונית לפני פתיחת תיק המע\"מ — עבירה.",
    ],
    steps: `1. פתחו תיק מע"מ לחברה (כעוסק מורשה) — טופס 821, עם תעודת ההתאגדות ומספר הח.פ.
2. ודאו פתיחת תיק מס הכנסה לחברה (מס חברות)
3. אם תמשכו משכורת או תעסיקו — פתחו תיק ניכויים
4. רוב החברות עושות את זה דרך רו"ח, שגם יסדיר את מקדמות מס ההכנסה
5. שמרו את מספרי התיקים — לכל דיווח ולכל פנייה`,
    official_links: [
      { label: "פתיחת תיק עוסק מורשה (טופס 821)", url: "https://www.gov.il/he/service/vat-821" },
      { label: "רשות המסים — חברות", url: "https://www.gov.il/he/departments/israel_tax_authority" },
    ],
    docs_needed: ["תעודת התאגדות ומספר ח.פ.", "אסמכתת חשבון בנק של החברה", "פרטי בעלי מניות ודירקטורים"],
    est_cost: "חינם (למעט שכ\"ט רו\"ח)",
    est_time: "כשעה + טיפול רו\"ח",
    completion: {
      confirm: "פתחתי לחברה תיק מע\"מ ותיק מס הכנסה",
      fields: [
        { key: "vat_file", label: "מספר תיק מע\"מ של החברה", writesTo: "vat_file" },
        { key: "income_tax_file", label: "מספר תיק מס הכנסה של החברה", writesTo: "income_tax_file" },
      ],
    },
    applies_when: { entity_type: ["company"] },
    depends_on: ["register-company"],
    deadline_days: 7,
    priority: "critical",
    source_url: "https://www.gov.il/he/service/vat-821",
    last_reviewed: REVIEWED,
    sort_order: 2,
  },
  {
    id: "company-bank-account",
    category_id: "legal-setup",
    title: "חשבון בנק על שם החברה",
    why: "לחברה חייב להיות חשבון בנק נפרד על שמה — לא חשבון פרטי של הבעלים. ערבוב כספים פוגע בהגנת האחריות המוגבלת ומקשה על הנהלת חשבונות.",
    after_submit:
      "אחרי פתיחת החשבון תוכלו לחבר סליקה, לקבל תשלומים על שם החברה ולשלם ספקים. חברו את החשבון לתוכנת ההנהלת חשבונות של הרו\"ח.",
    pitfalls: [
      "להשתמש בחשבון פרטי לפעילות החברה — מסכן את מסך ההתאגדות (הרמת מסך) ומבלבל את הספרים.",
      "לא להביא את כל מסמכי החברה — הבנק ידרוש תעודת התאגדות, תקנון ופרוטוקול מורשי חתימה.",
    ],
    steps: `1. קבעו פגישה בבנק העסקי עם כל מורשי החתימה
2. הביאו: תעודת התאגדות, תקנון, פרוטוקול מינוי מורשי חתימה, ותעודות זהות
3. הגדירו מורשי חתימה והרשאות
4. בקשו פנקסי החברה, כרטיס וגישה דיגיטלית`,
    official_links: [
      { label: "פתיחת חשבון עסקי — מדריך", url: "https://www.kolzchut.org.il/he/פתיחת_חשבון_בנק_עסקי" },
    ],
    docs_needed: ["תעודת התאגדות", "תקנון החברה", "פרוטוקול מורשי חתימה", "תעודות זהות"],
    est_cost: "עמלות ניהול חשבון",
    est_time: "פגישה + כמה ימי עסקים",
    applies_when: { entity_type: ["company"] },
    depends_on: ["register-company"],
    deadline_days: 14,
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/פתיחת_חשבון_בנק_עסקי",
    last_reviewed: REVIEWED,
    sort_order: 3,
  },
  {
    id: "company-annual-fee",
    category_id: "tax",
    title: "אגרה שנתית לרשם החברות",
    why: "כל חברה חייבת באגרה שנתית לרשם החברות. שילום עד 31 במרץ מזכה בתעריף מופחת ({{registrarAnnualFeeReduced}} ב-2026); אחריו קופץ לתעריף הרגיל ({{registrarAnnualFeeRegular}}). אי-תשלום מצטבר לחוב ועלול להוביל לחברה מפרה.",
    after_submit:
      "אחרי התשלום שמרו את האסמכתא. האגרה חוזרת כל שנה קלנדרית — המערכת תזכיר לקראת סוף מרץ כדי לנצל את התעריף המופחת.",
    pitfalls: [
      "לפספס את ה-31.3 ולשלם את התעריף הרגיל — הפרש של מאות שקלים סתם.",
      "לצבור אי-תשלום שנים — החברה מוכרזת 'מפרת חוק', ולבעלים ולדירקטורים נחסמות פעולות.",
    ],
    steps: `1. שלמו את האגרה השנתית באתר רשות התאגידים לפי מספר הח"פ
2. שלמו עד 31 במרץ כדי לקבל את התעריף המופחת ({{registrarAnnualFeeReduced}} ב-2026 במקום {{registrarAnnualFeeRegular}})
3. שמרו את אישור התשלום`,
    official_links: [
      { label: "תשלום אגרה שנתית לחברה — רשות התאגידים", url: "https://www.gov.il/he/service/company_partnership_annual_payment" },
    ],
    docs_needed: ["מספר ח.פ."],
    est_cost: "{{registrarAnnualFeeReduced}} מופחת / {{registrarAnnualFeeRegular}} רגיל (2026)",
    est_time: "10 דקות",
    completion: {
      confirm: "שילמתי את האגרה השנתית ושמרתי את האישור",
      fields: [
        { key: "amount", label: "הסכום ששולם (₪)", type: "amount", required: true },
        { key: "reference", label: "אסמכתת התשלום", type: "reference" },
      ],
    },
    applies_when: { entity_type: ["company"] },
    depends_on: ["register-company"],
    deadline_days: 30,
    recurrence: "yearly",
    priority: "important",
    source_url: "https://www.gov.il/he/service/company_partnership_annual_payment",
    last_reviewed: REVIEWED,
    sort_order: 20,
  },
  {
    id: "company-annual-report-financials",
    category_id: "tax",
    title: "דוחות כספיים מבוקרים, דוח שנתי לרשם ומס חברות",
    why: "חברה חייבת בדוחות כספיים מבוקרים על ידי רו\"ח, בדוח שנתי לרשם החברות, ובדוח מס חברות שנתי (טופס 1214). רווחי החברה מחויבים במס חברות של {{corporateTaxRate}}.",
    after_submit:
      "אחרי הגשת הדוחות ותשלום המס מתקבלות אסמכתאות. משיכת רווחים לבעלים (דיבידנד) ממוסה בנוסף — כדאי לתכנן מול הרו\"ח את שילוב המשכורת/דיבידנד.",
    pitfalls: [
      "לנהל חברה בלי רו\"ח — דוח מבוקר הוא חובה, לא בחירה.",
      "לשכוח שמס חברות ({{corporateTaxRate}}) חל על רווחי החברה, ומשיכת דיבידנד ממוסה בנפרד אצל הבעלים.",
      "לאחר בהגשת הדוח לרשם — עלול להוביל לעיצומים ולחברה מפרה.",
    ],
    steps: `1. עבדו עם רו"ח שיכין דוחות כספיים מבוקרים לשנה
2. הגישו דוח שנתי לרשם החברות (כולל עדכון פרטי בעלי מניות ודירקטורים)
3. הגישו דוח מס חברות שנתי (טופס 1214) ושלמו מס חברות על הרווח ({{corporateTaxRate}})
4. תכננו מול הרו"ח את שילוב המשכורת והדיבידנד למשיכת רווחים`,
    official_links: [
      { label: "מס חברות — רשות המסים", url: "https://www.gov.il/he/departments/israel_tax_authority" },
      { label: "דוח שנתי לרשם החברות — רשות התאגידים", url: "https://www.gov.il/he/departments/topics/corporations_authority" },
    ],
    docs_needed: ["הנהלת חשבונות שנתית", "דוחות כספיים מבוקרים"],
    est_cost: "שכ\"ט רו\"ח + מס חברות {{corporateTaxRate}} על הרווח",
    est_time: "תהליך שנתי מול רו\"ח",
    applies_when: { entity_type: ["company"] },
    depends_on: ["company-tax-files"],
    deadline_days: 365,
    recurrence: "yearly",
    priority: "critical",
    source_url: "https://www.gov.il/he/departments/israel_tax_authority",
    last_reviewed: REVIEWED,
    sort_order: 21,
  },

  // ============ שותפות רשומה ============
  {
    id: "register-partnership",
    category_id: "legal-setup",
    title: "רישום שותפות ברשם השותפויות",
    why: "שותפות שמנהלת עסק צריכה להירשם אצל רשם השותפויות. הרישום מסדיר את מעמד השותפות מול צדדים שלישיים ובנקים. אגרת רישום שותפות כללית {{partnershipRegistrationGeneral}} (מוגבלת {{partnershipRegistrationLimited}}) ב-2026.",
    after_submit:
      "אחרי הרישום מתקבלת תעודת רישום ומספר שותפות. שנה אחרי הרישום מתחילה חובת אגרה שנתית לרשם השותפויות. השותפות עצמה שקופה למס — כל שותף מדווח על חלקו.",
    pitfalls: [
      "לנהל שותפות בלי הסכם שותפות בכתב — מקור מספר אחת לסכסוכים.",
      "לחשוב שהשותפות משלמת מס הכנסה — היא שקופה: כל שותף ממוסה אישית על חלקו ברווח.",
      "לפספס את האגרה השנתית לרשם השותפויות.",
    ],
    steps: `1. גבשו הסכם שותפות (ראו משימה נפרדת) המגדיר חלוקת רווחים, ניהול וזכויות
2. הגישו בקשת רישום לרשם השותפויות עם פרטי השותפים ושם השותפות
3. שלמו את אגרת הרישום (שותפות כללית {{partnershipRegistrationGeneral}} / מוגבלת {{partnershipRegistrationLimited}} ב-2026)
4. פתחו לשותפות תיק מע"מ; כל שותף מסדיר תיק מס הכנסה על חלקו`,
    official_links: [
      { label: "רשם השותפויות — רשות התאגידים", url: "https://www.gov.il/he/departments/topics/registrar_of_partnerships/govil-landing-page" },
      { label: "שותפות — כל-זכות", url: "https://www.kolzchut.org.il/he/שותפות" },
    ],
    docs_needed: ["תעודות זהות של השותפים", "הסכם שותפות", "שם השותפות ותחום העיסוק"],
    est_cost: "{{partnershipRegistrationGeneral}} כללית / {{partnershipRegistrationLimited}} מוגבלת (2026)",
    est_time: "כמה ימי עסקים",
    applies_when: { entity_type: ["partnership"] },
    depends_on: [],
    deadline_days: 0,
    priority: "important",
    source_url: "https://www.gov.il/he/departments/topics/registrar_of_partnerships/govil-landing-page",
    last_reviewed: REVIEWED,
    sort_order: 4,
  },
  {
    id: "partnership-agreement",
    category_id: "insurance-legal",
    title: "הסכם שותפות בכתב",
    why: "הסכם שותפות מגדיר חלוקת רווחים והפסדים, סמכויות ניהול, הכנסת/יציאת שותף וטיפול בסכסוכים. בלעדיו חלים ברירות מחדל של חוק השותפויות — שלרוב לא מתאימות למה שהתכוונתם.",
    pitfalls: [
      "להתחיל לעבוד 'על סמך אמון' בלי הסכם — הבעיות מתגלות בדיוק כשקשה לפתור אותן.",
      "לא להגדיר מנגנון פרידה/פירוק — יציאת שותף בלי הסכם היא סיוט.",
    ],
    steps: `1. סכמו בין השותפים: חלוקת רווחים/הפסדים, הון ראשוני, תפקידים וסמכויות חתימה
2. הגדירו מנגנון להכנסת שותף, יציאת שותף ופירוק
3. הגדירו כיצד מקבלים החלטות ואיך פותרים מחלוקות
4. חתמו על ההסכם מול עו"ד — עדיף לפני תחילת הפעילות`,
    official_links: [
      { label: "שותפות — כל-זכות", url: "https://www.kolzchut.org.il/he/שותפות" },
    ],
    docs_needed: ["טיוטת הסכם שותפות"],
    est_cost: "שכ\"ט עו\"ד",
    est_time: "פגישה או שתיים",
    applies_when: { entity_type: ["partnership"] },
    depends_on: [],
    deadline_days: 0,
    priority: "important",
    source_url: "https://www.kolzchut.org.il/he/שותפות",
    last_reviewed: REVIEWED,
    sort_order: 5,
  },
  {
    id: "partnership-annual-fee",
    category_id: "tax",
    title: "אגרה שנתית לרשם השותפויות",
    why: "שותפות רשומה חייבת באגרה שנתית לרשם השותפויות. תשלום עד 31 במרץ מזכה בתעריף מופחת ({{partnershipAnnualFeeReduced}} ב-2026); אחריו התעריף הרגיל ({{partnershipAnnualFeeRegular}}).",
    after_submit:
      "שמרו את אסמכתת התשלום. האגרה חוזרת כל שנה קלנדרית — המערכת תזכיר לקראת סוף מרץ.",
    pitfalls: [
      "לפספס את ה-31.3 ולשלם את התעריף הרגיל.",
      "להזניח את האגרה שנים — צובר חוב מול הרשם.",
    ],
    steps: `1. שלמו את האגרה השנתית באתר רשות התאגידים לפי מספר השותפות
2. שלמו עד 31 במרץ לתעריף המופחת ({{partnershipAnnualFeeReduced}} במקום {{partnershipAnnualFeeRegular}} ב-2026)
3. שמרו אישור תשלום`,
    official_links: [
      { label: "תשלום אגרה שנתית לשותפות — רשות התאגידים", url: "https://www.gov.il/he/service/company_partnership_annual_payment" },
    ],
    docs_needed: ["מספר שותפות"],
    est_cost: "{{partnershipAnnualFeeReduced}} מופחת / {{partnershipAnnualFeeRegular}} רגיל (2026)",
    est_time: "10 דקות",
    completion: {
      confirm: "שילמתי את האגרה השנתית ושמרתי את האישור",
      fields: [
        { key: "amount", label: "הסכום ששולם (₪)", type: "amount", required: true },
        { key: "reference", label: "אסמכתת התשלום", type: "reference" },
      ],
    },
    applies_when: { entity_type: ["partnership"] },
    depends_on: ["register-partnership"],
    deadline_days: 30,
    recurrence: "yearly",
    priority: "important",
    source_url: "https://www.gov.il/he/service/company_partnership_annual_payment",
    last_reviewed: REVIEWED,
    sort_order: 22,
  },
];
