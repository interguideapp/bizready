import type { OnboardingAnswers } from "@/lib/types";

/**
 * Document generator engine.
 *
 * Turns the business's own profile into a real, ready-to-use legal document —
 * a privacy policy, accessibility statement, client agreement, employee notice
 * or website terms — instead of "go write one". This is the painkiller: the
 * output is a finished draft the owner can print, save as PDF and file, not a
 * link to a form. Every document is a general template for adaptation and
 * carries a clear disclaimer that it is not legal advice.
 *
 * Pure & tested. No dependencies — documents render to self-contained HTML that
 * the browser prints to PDF (no server-side PDF library needed).
 */

export interface GeneratorContext {
  businessName: string;
  entityType?: string; // osek_patur | osek_murshe
  dealerNumber?: string | null;
  field?: string | null;
  answers?: Partial<OnboardingAnswers>;
  today?: Date;
}

export interface DocSection {
  heading?: string;
  paragraphs: string[];
}

export interface GeneratedDoc {
  title: string;
  intro?: string;
  sections: DocSection[];
  disclaimer: string;
  updatedLabel: string; // "עודכן: dd.mm.yyyy"
}

export interface DocGenerator {
  id: string;
  title: string;
  description: string;
  category: string; // documents-vault category
  templateId: string; // the task this document belongs to
  /** Only offer the generator when it's relevant to the business profile. */
  isRelevant?: (ctx: GeneratorContext) => boolean;
  build: (ctx: GeneratorContext) => GeneratedDoc;
}

// ---------- helpers ----------

function heDate(d: Date): string {
  return d.toLocaleDateString("he-IL");
}

const DISCLAIMER =
  "מסמך זה הופק אוטומטית כתבנית כללית להתאמה אישית ואינו מהווה ייעוץ משפטי. " +
  "השלימו את הפרטים המופיעים בסוגריים מרובעים, התאימו את התוכן לפעילות העסק, " +
  "ולפני פרסום או שימוש מחייב — מומלץ להיוועץ בעורך/ת דין.";

function entityLine(ctx: GeneratorContext): string {
  const parts = [ctx.businessName];
  if (ctx.entityType === "osek_murshe") parts.push("(עוסק מורשה)");
  else if (ctx.entityType === "osek_patur") parts.push("(עוסק פטור)");
  if (ctx.dealerNumber) parts.push(`מס' עוסק ${ctx.dealerNumber}`);
  return parts.join(" ");
}

// ---------- the documents ----------

const privacyPolicy: DocGenerator = {
  id: "privacy-policy",
  title: "מדיניות פרטיות",
  description:
    "מסמך פרטיות מותאם לתיקון 13 לחוק הגנת הפרטיות — מי אתם, איזה מידע נאסף, למה, וזכויות הלקוח.",
  category: "agreements",
  templateId: "privacy-policy",
  isRelevant: (ctx) => ctx.answers?.collects_personal_data !== false,
  build: (ctx) => {
    const today = ctx.today ?? new Date();
    return {
      title: "מדיניות פרטיות",
      intro: `${entityLine(
        ctx
      )} ("העסק", "אנחנו") מכבד את פרטיות הלקוחות והמשתמשים ופועל בהתאם לחוק הגנת הפרטיות, התשמ"א-1981 ולתיקון 13 לחוק. מסמך זה מסביר איזה מידע אנו אוספים, כיצד אנו משתמשים בו ומהן זכויותיכם.`,
      sections: [
        {
          heading: "1. איזה מידע אנו אוספים",
          paragraphs: [
            "מידע שאתם מוסרים לנו ביוזמתכם — שם, טלפון, דוא\"ל, וכן פרטים הדרושים לאספקת השירות או המוצר.",
            "מידע הנאסף אוטומטית בעת שימוש באתר/בשירות — כגון נתוני שימוש וקבצי Cookie, ככל שרלוונטי.",
          ],
        },
        {
          heading: "2. מטרות השימוש במידע",
          paragraphs: [
            "אספקת השירות או המוצר, יצירת קשר, טיפול בפניות, חיוב וגבייה, ועמידה בחובות שבדין (כגון הנהלת חשבונות ודיווח לרשויות).",
            "שיווק ודיוור ישיר — יבוצעו רק בהתאם להסכמתכם וניתן להסיר בכל עת.",
          ],
        },
        {
          heading: "3. מסירת מידע לצד שלישי",
          paragraphs: [
            "לא נעביר את המידע לצדדים שלישיים אלא לצורך מתן השירות (למשל ספק סליקה, מערכת חשבוניות, שירות משלוחים), מכוח דרישה חוקית, או בהסכמתכם.",
          ],
        },
        {
          heading: "4. אבטחת מידע",
          paragraphs: [
            "אנו נוקטים באמצעים סבירים לשמירת המידע מפני גישה, שימוש או חשיפה בלתי מורשים, בהתאם לתקנות הגנת הפרטיות (אבטחת מידע).",
          ],
        },
        {
          heading: "5. זכויותיכם (תיקון 13)",
          paragraphs: [
            "זכות לדעת אילו פרטים מוחזקים אצלנו, לעיין בהם, לבקש את תיקונם או מחיקתם, ולהתנגד לשימוש בהם לצורך דיוור ישיר.",
            "למימוש הזכויות פנו אלינו בפרטים שבסוף המסמך. נשיב לפנייתכם בתוך פרק זמן סביר וכנדרש בדין.",
          ],
        },
        {
          heading: "6. עוגיות (Cookies)",
          paragraphs: [
            "האתר עשוי לעשות שימוש בעוגיות לצורך תפעול ושיפור השירות. ניתן לחסום עוגיות בהגדרות הדפדפן, אך חלק מהפונקציות עלולות שלא לפעול כראוי.",
          ],
        },
        {
          heading: "7. יצירת קשר",
          paragraphs: [
            `בכל שאלה או בקשה בנוגע לפרטיות ניתן לפנות אל ${ctx.businessName} בכתובת דוא"ל [דוא"ל ליצירת קשר] או בטלפון [טלפון].`,
          ],
        },
      ],
      disclaimer: DISCLAIMER,
      updatedLabel: `עודכן: ${heDate(today)}`,
    };
  },
};

const accessibilityStatement: DocGenerator = {
  id: "accessibility-statement",
  title: "הצהרת נגישות",
  description:
    "הצהרת נגישות לאתר/לעסק לפי תקנות שוויון זכויות לאנשים עם מוגבלות ות\"י 5568.",
  category: "agreements",
  templateId: "accessibility-statement",
  build: (ctx) => {
    const today = ctx.today ?? new Date();
    return {
      title: "הצהרת נגישות",
      intro: `${entityLine(
        ctx
      )} רואה חשיבות רבה במתן שירות שוויוני לכלל הלקוחות ופועל להנגשת האתר והשירות בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998 ולתקנותיו.`,
      sections: [
        {
          heading: "רמת הנגישות",
          paragraphs: [
            'האתר הונגש בהתאם לתקן הישראלי ת"י 5568 המבוסס על הנחיות WCAG 2.0 ברמת AA, ככל שהדבר ניתן.',
          ],
        },
        {
          heading: "התאמות שבוצעו",
          paragraphs: [
            "ניווט מקלדת, מבנה כותרות היררכי, טקסט חלופי לתמונות, ניגודיות צבעים נאותה והתאמה לקוראי מסך — במידה שהדבר יושם באתר.",
          ],
        },
        {
          heading: "מגבלות ידועות",
          paragraphs: [
            "ייתכנו דפים או רכיבים שטרם הונגשו במלואם. אנו פועלים לשיפור מתמיד ונשמח לקבל דיווח על כל קושי.",
          ],
        },
        {
          heading: "רכז/ת נגישות ודרכי פנייה",
          paragraphs: [
            `נתקלתם בבעיה או שיש לכם הצעה לשיפור? פנו אל רכז/ת הנגישות של ${ctx.businessName}: [שם], דוא"ל [דוא"ל], טלפון [טלפון]. נטפל בפנייתכם בהקדם.`,
          ],
        },
      ],
      disclaimer: DISCLAIMER,
      updatedLabel: `עודכן: ${heDate(today)}`,
    };
  },
};

const clientAgreement: DocGenerator = {
  id: "client-agreement",
  title: "הסכם התקשרות עם לקוח",
  description:
    "הסכם שירות בסיסי בין העסק ללקוח — היקף, תמורה, ביטולים, אחריות וקניין רוחני.",
  category: "agreements",
  templateId: "client-agreement",
  build: (ctx) => {
    const today = ctx.today ?? new Date();
    return {
      title: "הסכם התקשרות למתן שירות",
      intro: `הסכם זה נערך ונחתם בין ${entityLine(
        ctx
      )} ("נותן השירות") לבין [שם הלקוח], ת.ז./ח.פ. [מספר] ("הלקוח").`,
      sections: [
        {
          heading: "1. השירות",
          paragraphs: [
            "נותן השירות יספק ללקוח את השירותים הבאים: [תיאור השירות]. היקף העבודה, לוחות הזמנים והתוצרים יפורטו בהצעת המחיר/נספח המצורף.",
          ],
        },
        {
          heading: "2. תמורה ותנאי תשלום",
          paragraphs: [
            "בתמורה לשירות ישלם הלקוח סך של [סכום] ₪ [בתוספת מע\"מ כדין / ללא מע\"מ]. התשלום יבוצע [מקדמה/תשלום מלא/שוטף+X] באמצעות [אמצעי תשלום].",
          ],
        },
        {
          heading: "3. ביטולים",
          paragraphs: [
            "ביטול ההתקשרות יתאפשר בהודעה מראש של [מספר] ימים. בגין עבודה שבוצעה עד מועד הביטול ישולם החלק היחסי.",
          ],
        },
        {
          heading: "4. אחריות והגבלתה",
          paragraphs: [
            "נותן השירות יבצע את העבודה במקצועיות ובמיומנות סבירה. אחריותו לא תעלה על סכום התמורה ששולמה בפועל, ולא יחוב בנזקים עקיפים או תוצאתיים.",
          ],
        },
        {
          heading: "5. קניין רוחני",
          paragraphs: [
            "זכויות הקניין הרוחני בתוצרים יעברו ללקוח עם השלמת התשלום המלא, אלא אם הוסכם אחרת בכתב.",
          ],
        },
        {
          heading: "6. סודיות",
          paragraphs: [
            "כל צד ישמור בסודיות מידע עסקי שנמסר לו במסגרת ההתקשרות ולא יעשה בו שימוש אלא לצורך ביצוע ההסכם.",
          ],
        },
        {
          heading: "7. שונות",
          paragraphs: [
            "על הסכם זה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים ב[עיר].",
          ],
        },
        {
          heading: "חתימות",
          paragraphs: [
            "נותן השירות: ______________   תאריך: __________",
            "הלקוח: ______________   תאריך: __________",
          ],
        },
      ],
      disclaimer: DISCLAIMER,
      updatedLabel: `נערך: ${heDate(today)}`,
    };
  },
};

const employmentTermsNotice: DocGenerator = {
  id: "employment-terms-notice",
  title: "הודעה לעובד על תנאי עבודה",
  description:
    "הודעה בכתב לעובד/ת כנדרש בחוק הודעה לעובד — תפקיד, שכר, היקף והפרשות.",
  category: "agreements",
  templateId: "employment-terms-notice",
  isRelevant: (ctx) => ctx.answers?.plans_employees === true,
  build: (ctx) => {
    const today = ctx.today ?? new Date();
    return {
      title: "הודעה לעובד/ת על תנאי עבודה",
      intro: `בהתאם לחוק הודעה לעובד ולמועמד לעבודה, התשס"ב-2002, מוסר ${entityLine(
        ctx
      )} ("המעסיק") לעובד/ת את פרטי תנאי העבודה כדלקמן.`,
      sections: [
        {
          heading: "פרטי העובד/ת",
          paragraphs: ["שם: [שם מלא]", "ת.ז.: [מספר]", "כתובת: [כתובת]"],
        },
        {
          heading: "תחילת עבודה ותפקיד",
          paragraphs: [
            "תאריך תחילת עבודה: [תאריך]",
            "תפקיד עיקרי ותיאורו: [תיאור התפקיד]",
            "שם/תפקיד הממונה הישיר: [ממונה]",
          ],
        },
        {
          heading: "שכר ותשלומים",
          paragraphs: [
            "בסיס השכר: [סכום] ₪ ל[שעה/חודש].",
            "מועד תשלום השכר: עד ה-9 בכל חודש עבור החודש שקדם לו.",
            "תוספות/החזרים ככל שסוכמו: [פירוט].",
          ],
        },
        {
          heading: "היקף משרה ושעות",
          paragraphs: [
            "היקף המשרה: [מלאה/חלקית — %].",
            "ימי ושעות העבודה: [פירוט].",
            "יום המנוחה השבועי: [שבת/יום אחר].",
          ],
        },
        {
          heading: "הפרשות סוציאליות",
          paragraphs: [
            "המעסיק יפריש עבור העובד/ת לפנסיה ולפיצויים בהתאם לצו ההרחבה לפנסיה חובה ולדין החל.",
            "הבראה, חופשה ומחלה יינתנו כחוק.",
          ],
        },
        {
          heading: "חתימות",
          paragraphs: [
            "המעסיק: ______________   תאריך: __________",
            "העובד/ת (לאישור קבלה): ______________   תאריך: __________",
          ],
        },
      ],
      disclaimer: DISCLAIMER,
      updatedLabel: `נערך: ${heDate(today)}`,
    };
  },
};

const websiteTerms: DocGenerator = {
  id: "website-terms",
  title: "תקנון אתר / תנאי שימוש",
  description:
    "תקנון לאתר העסק — כללי שימוש, מכר, משלוחים והחזרות (למוצרים פיזיים) וקניין רוחני.",
  category: "agreements",
  templateId: "website-terms",
  isRelevant: (ctx) =>
    ctx.answers?.has_website === true ||
    ctx.answers?.sales_channel === "online" ||
    ctx.answers?.sales_channel === "both",
  build: (ctx) => {
    const today = ctx.today ?? new Date();
    const sellsPhysical =
      ctx.answers?.product_type === "physical_products" ||
      ctx.answers?.product_type === "mixed";
    const sections: DocSection[] = [
      {
        heading: "1. כללי",
        paragraphs: [
          `תקנון זה מסדיר את השימוש באתר של ${entityLine(
            ctx
          )} ("האתר"). עצם השימוש באתר מהווה הסכמה לתנאים אלה.`,
        ],
      },
      {
        heading: "2. השימוש באתר",
        paragraphs: [
          "המשתמש מתחייב לעשות שימוש חוקי והוגן באתר ולא לפגוע בפעילותו או בזכויות צדדים שלישיים.",
        ],
      },
    ];
    if (sellsPhysical || ctx.answers?.product_type === "digital_products") {
      sections.push({
        heading: "3. מכירה ותשלום",
        paragraphs: [
          "מחירי המוצרים/השירותים מוצגים באתר וכוללים מע\"מ כדין (ככל שחל). ההזמנה תיחשב כמושלמת לאחר אישור התשלום.",
        ],
      });
    }
    if (sellsPhysical) {
      sections.push({
        heading: "4. משלוחים והחזרות",
        paragraphs: [
          "זמני אספקה משוערים: [פירוט]. ביטול עסקה והחזרת מוצרים יתאפשרו בהתאם לחוק הגנת הצרכן, התשמ\"א-1981 ותקנותיו.",
        ],
      });
    }
    sections.push(
      {
        heading: `${sections.length + 1}. קניין רוחני`,
        paragraphs: [
          "כל הזכויות בתכני האתר, בעיצובו ובסימני המסחר שמורות לעסק. אין להעתיק או לעשות שימוש מסחרי ללא אישור בכתב.",
        ],
      },
      {
        heading: `${sections.length + 2}. אחריות ודין`,
        paragraphs: [
          "השירות ניתן כמות שהוא (AS IS). על תקנון זה יחולו דיני מדינת ישראל וסמכות השיפוט נתונה לבתי המשפט המוסמכים ב[עיר].",
        ],
      }
    );
    return {
      title: "תקנון ותנאי שימוש",
      intro: undefined,
      sections,
      disclaimer: DISCLAIMER,
      updatedLabel: `עודכן: ${heDate(today)}`,
    };
  },
};

export const DOC_GENERATORS: DocGenerator[] = [
  privacyPolicy,
  accessibilityStatement,
  clientAgreement,
  employmentTermsNotice,
  websiteTerms,
];

export const GENERATORS_BY_ID = new Map(DOC_GENERATORS.map((g) => [g.id, g]));
export const GENERATOR_BY_TEMPLATE = new Map(
  DOC_GENERATORS.map((g) => [g.templateId, g])
);

// ---------- self-contained HTML rendering (print / save) ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a generated document to a self-contained, print-ready HTML string.
 * Used both by the print route and when saving the document to the vault.
 */
export function renderDocHtml(doc: GeneratedDoc, businessName: string): string {
  const sections = doc.sections
    .map((s) => {
      const heading = s.heading
        ? `<h2>${escapeHtml(s.heading)}</h2>`
        : "";
      const body = s.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("\n");
      return `<section>${heading}\n${body}</section>`;
    })
    .join("\n");

  const intro = doc.intro ? `<p class="intro">${escapeHtml(doc.intro)}</p>` : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(doc.title)} — ${escapeHtml(businessName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; line-height: 1.7;
         max-width: 780px; margin: 0 auto; padding: 48px 32px; background: #fff; }
  header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 24px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .biz { color: #555; font-size: 14px; }
  .updated { color: #888; font-size: 12px; margin-top: 4px; }
  .intro { font-size: 15px; }
  h2 { font-size: 17px; margin: 22px 0 6px; }
  p { margin: 6px 0; font-size: 14px; }
  .disclaimer { margin-top: 32px; padding: 12px 14px; border: 1px solid #ddd;
                background: #fafafa; color: #666; font-size: 12px; border-radius: 8px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(doc.title)}</h1>
  <div class="biz">${escapeHtml(businessName)}</div>
  <div class="updated">${escapeHtml(doc.updatedLabel)}</div>
</header>
${intro}
${sections}
<div class="disclaimer">${escapeHtml(doc.disclaimer)}</div>
</body>
</html>`;
}
