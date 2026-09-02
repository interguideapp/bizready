"use client";

import { useState } from "react";
import {
  Check,
  ClipboardList,
  ExternalLink,
  HelpCircle,
  ListChecks,
  ListTodo,
  Paperclip,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { StepsContent } from "@/components/steps-content";
import { TaskChecklist } from "@/components/task-checklist";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentGenerator } from "@/components/document-generator";
import { CeilingMeter } from "@/components/kits/ceiling-meter";
import { PricingCalculator } from "@/components/kits/pricing-calculator";
import type { TaskView } from "@/lib/task-view";
import type { Phase } from "@/components/task/task-experience";

/** The archetype-labeled primary action shown under the hero. */
export function archetypePrimaryCta(view: TaskView): {
  label: string;
  href?: string;
  goTo?: Phase;
} {
  const link = view.primaryLink?.url;
  switch (view.archetype) {
    case "registration":
      return link ? { label: "פתיחת התיק באתר הרשמי", href: link } : { label: "בואו נפתח את התיק", goTo: "act" };
    case "filing":
      return link ? { label: "לדיווח ולתשלום", href: link } : { label: "בואו נדווח", goTo: "act" };
    case "decision":
      return { label: "בדקו אם זה חל עליכם", goTo: "act" };
    case "provider":
      return { label: "להשוואה ובחירה", goTo: "act" };
    case "document":
      return { label: "יצירת המסמך", goTo: "act" };
    case "presence":
      return link ? { label: "בואו נקים את זה", href: link } : { label: "בואו נקים את זה", goTo: "act" };
    case "calculator":
      return { label: "פתחו את הכלי", goTo: "act" };
    default:
      return { label: "בואו נסדיר את זה", goTo: "act" };
  }
}

export function ArchetypeAction({
  view,
  attachedDocs,
  docCategory,
}: {
  view: TaskView;
  attachedDocs: { id: string; name: string; url?: string }[];
  docCategory: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ArchetypeHero view={view} />

      {/* how-to steps — shared, re-skinned */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
          <ListTodo className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          איך עושים את זה
        </h2>
        <Card className="p-5">
          <StepsContent text={view.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")} />
        </Card>
      </section>

      {/* personal checklist */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
          <ListChecks className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          הדרך שלי
        </h2>
        <p className="mb-3 text-sm text-ink-muted">
          צעדים משלכם — סמנו כשמתקדמים, וצרפו קבצים לכל צעד
        </p>
        <Card className="p-4">
          <TaskChecklist
            taskId={view.taskDbId}
            items={view.checklist}
            docs={attachedDocs.map((d) => ({
              id: d.id,
              name: d.name,
              checklist_item_id: null,
              url: d.url,
            }))}
            docCategory={docCategory}
          />
        </Card>
      </section>

      {/* attach documents */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-section text-ink">
          <Paperclip className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          המסמכים של המשימה
        </h2>
        <Card className="p-4">
          <p className="mb-3 text-sm text-ink-muted">
            קיבלתם תעודה, אישור או פוליסה? תייקו כאן — יישמר בארכיון העסק.
          </p>
          <DocumentUpload category={docCategory} taskId={view.taskDbId} label="צירוף מסמך" />
        </Card>
      </section>
    </div>
  );
}

/** The distinctive top element per archetype — the heart of "unique experience". */
function ArchetypeHero({ view }: { view: TaskView }) {
  switch (view.archetype) {
    case "registration":
      return <RegistrationHero view={view} />;
    case "decision":
      return <DecisionHero view={view} />;
    case "provider":
      return <ProviderHero view={view} />;
    case "document":
      return <DocumentHero view={view} />;
    case "presence":
      return <PresenceHero view={view} />;
    case "calculator":
      return <CalculatorHero view={view} />;
    case "filing":
      return <FilingHero view={view} />;
    default:
      return <RoutineHero view={view} />;
  }
}

function RegistrationHero({ view }: { view: TaskView }) {
  const [checked, setChecked] = useState<boolean[]>(view.docsNeeded.map(() => false));
  const allReady = checked.length === 0 || checked.every(Boolean);
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-edge-soft bg-brand-tint/40 px-5 py-3.5">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          <ClipboardList className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
          לפני שמתחילים — אספו את המסמכים
        </h3>
      </div>
      <div className="p-4">
        {view.docsNeeded.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-1.5">
            {view.docsNeeded.map((d, i) => (
              <li key={d}>
                <button
                  onClick={() => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-edge-soft px-3 py-2 text-right text-sm transition hover:border-edge"
                >
                  <span
                    className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition ${
                      checked[i] ? "border-status-done bg-status-done text-white" : "border-edge-strong bg-card"
                    }`}
                  >
                    {checked[i] && <Check className="h-3 w-3" aria-hidden />}
                  </span>
                  <span className={checked[i] ? "text-ink-muted line-through" : "text-ink-soft"}>{d}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">אין מסמכים מיוחדים להכנה — אפשר לגשת ישר לרשות.</p>
        )}
        {view.primaryLink && (
          <a href={view.primaryLink.url} target="_blank" rel="noopener noreferrer">
            <Button fullWidth disabled={!allReady} icon={<ExternalLink className="h-4 w-4" aria-hidden />}>
              {allReady ? view.primaryLink.label : "סמנו שהכל מוכן כדי להמשיך"}
            </Button>
          </a>
        )}
        <p className="mt-2 text-center text-xs text-ink-faint">
          כשתקבלו את מספר התיק — עברו ל״לסגור״ ותעדו אותו; הוא יישמר בכרטיס העסק.
        </p>
      </div>
    </Card>
  );
}

function FilingHero({ view }: { view: TaskView }) {
  return (
    <Card className="border-brand-edge bg-brand-tint/30 p-4">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <ClipboardList className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        התקופה הנוכחית
      </h3>
      {view.obligation ? (
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {view.obligation.periodLabel && <b className="text-ink">{view.obligation.periodLabel}</b>} —
          הגשה עד {new Date(view.obligation.dueDate + "T00:00:00").toLocaleDateString("he-IL")}. אספו את
          מסמכי התקופה, דווחו ושלמו, ואז תעדו את האסמכתא ב״לסגור״.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">אספו את מסמכי התקופה, דווחו ושלמו בזמן.</p>
      )}
    </Card>
  );
}

function DecisionHero({ view }: { view: TaskView }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  return (
    <Card className="p-5">
      <h3 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <HelpCircle className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        האם זה חל עליכם?
      </h3>
      <p className="mb-3 text-sm text-ink-muted">
        עברו על הצעדים למטה כדי לבדוק, וסמנו את המסקנה — היא תיתעד ב״לסגור״.
      </p>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAnswer(a)}
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              answer === a
                ? a === "yes"
                  ? "border-status-progress bg-status-progress-bg text-status-progress"
                  : "border-status-done bg-status-done-bg text-status-done"
                : "border-edge bg-card text-ink-soft hover:border-edge-strong"
            }`}
          >
            {a === "yes" ? "כן, כנראה חל עליי" : "לא נראה שחל עליי"}
          </button>
        ))}
      </div>
      {answer && (
        <p className="mt-3 rounded-xl bg-surface px-3 py-2.5 text-sm text-ink-soft">
          {answer === "yes"
            ? "מצוין שבדקתם. השלימו את הצעדים למטה, ותעדו את מה שנדרש ב״לסגור״."
            : "כדאי בכל זאת לתעד את הבדיקה — כך יש לכם אסמכתא שבדקתם. עברו ל״לסגור״ וסמנו."}
        </p>
      )}
    </Card>
  );
}

function ProviderHero({ view }: { view: TaskView }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <Scale className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        לבחור נכון — מה חשוב להשוות
      </h3>
      <p className="text-sm text-ink-muted">
        השוו לפחות 2–3 אפשרויות לפי הקריטריונים למטה, החליטו, ותעדו את הספק ב״לסגור״
        {view.offers.length > 0 && " — או קפצו דרך אחת מהצעות השותפים בצד"}.
      </p>
    </Card>
  );
}

function DocumentHero({ view }: { view: TaskView }) {
  if (view.generator && view.generatedDoc) {
    return (
      <DocumentGenerator
        generatorId={view.generator.id}
        title={view.generator.title}
        description={view.generator.description}
        doc={view.generatedDoc}
        businessName={view.businessName}
        category={view.generator.category}
        taskId={view.taskDbId}
        isPro={view.pro}
      />
    );
  }
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <Sparkles className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        מסמך מותאם לעסק
      </h3>
      <p className="mt-1 text-sm text-ink-muted">עקבו אחרי הצעדים למטה כדי להרכיב את המסמך ולתייק אותו.</p>
    </Card>
  );
}

function PresenceHero({ view }: { view: TaskView }) {
  return (
    <Card className="border-brand-edge bg-brand-tint/30 p-4">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <Sparkles className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        להקים, ואז לאמת
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        עברו על שלבי ההקמה למטה. בסיום — בדקו שהכל עובד (במיוחד במובייל), ותעדו את הקישור/הכתובת ב״לסגור״.
      </p>
    </Card>
  );
}

function CalculatorHero({ view }: { view: TaskView }) {
  if (view.templateId === "patur-ceiling-watch" && view.ceiling) {
    return (
      <Card className="p-5">
        <h3 className="mb-1 font-bold text-ink">מד תקרת עוסק פטור</h3>
        <p className="mb-4 text-sm text-ink-muted">עדכנו את המחזור וראו כמה נשאר עד התקרה — וכמה זמן</p>
        <CeilingMeter ceiling={view.ceiling} />
      </Card>
    );
  }
  if (view.templateId === "pricing") {
    return (
      <Card className="p-5">
        <h3 className="mb-1 font-bold text-ink">מחשבון תמחור</h3>
        <p className="mb-4 text-sm text-ink-muted">כמה לגבות לשעה כדי שהעסק יהיה רווחי? נחשב אחורה מהיעדים</p>
        <PricingCalculator />
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <Sparkles className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        סדנת עבודה
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        עברו על הצעדים למטה כתרגיל מודרך, ורשמו את המסקנות ב״הערות שלי״.
      </p>
    </Card>
  );
}

function RoutineHero({ view }: { view: TaskView }) {
  return (
    <Card className="border-brand-edge bg-brand-tint/20 p-4">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <ListChecks className="h-4.5 w-4.5 text-brand-strong" aria-hidden />
        להסדיר פעם אחת — ולתחזק
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        זה הרגל שוטף. הקימו אותו פעם אחת לפי הצעדים למטה
        {view.recurrence && " — ונחזיר לכם תזכורת כשצריך לרענן"}.
      </p>
    </Card>
  );
}
