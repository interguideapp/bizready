import type { TaskArchetype, TaskStatus } from "@/lib/types";
import { resolveArchetype } from "./archetypes";

/**
 * אבני דרך — where a task actually IS, per task.
 *
 * THE PROBLEM THIS REPLACES
 *
 * A task had four statuses (todo / in_progress / waiting / done) and the user
 * set them by hand, from a picker buried behind a tab called "לסגור". So after
 * filing something with an authority you had to go back into the task, click
 * through to that tab, choose "ממתין", TYPE what you were waiting for, and pick
 * a follow-up date yourself. The product knew all three of those things and
 * asked anyway. That is the double work.
 *
 * "בתהליך" and "ממתין לגורם חיצוני" are also the wrong resolution. They are
 * true of every task and specific to none, so they cannot answer the only
 * question the user has: where am I, and what happens next.
 *
 * WHAT THIS IS
 *
 * An ordered chain of named stages per task. The chain carries the knowledge:
 * who holds the ball at each stage, what the button that leaves it should say,
 * and when we should remind you to check. Advancing is ONE click, and from that
 * click the server derives the status, the "waiting for" text and the follow-up
 * date — the three things the user used to enter manually.
 *
 * ON `checkBackDays` — READ BEFORE ADDING ONE
 *
 * It is OUR reminder cadence, not a published service level. The product must
 * never tell someone "the authority will answer within 7 days" unless a cited
 * source says so; `after_submit` is where sourced timing prose lives, and it is
 * shown alongside. The UI copy for this number is therefore "נזכיר לבדוק
 * בעוד X", which is a promise about us and is always true.
 *
 * Stage ids are stored in business_tasks.stage, so they are permanent. Renaming
 * a label is free; changing an id orphans stored rows and must be treated as a
 * migration.
 */

/** Who the task is waiting on at this stage. */
export type StageOwner =
  /** The ball is with the user. */
  | "you"
  /** Handed off — an authority, a bank, a provider. Nothing to do but wait. */
  | "them"
  /** Terminal. */
  | "done";

export interface Stage {
  /** Permanent. Stored in the database. */
  id: string;
  /** Where we are, phrased as a state rather than an instruction. */
  label: string;
  owner: StageOwner;
  /**
   * The button that LEAVES this stage, phrased as something the user did.
   * Absent on a terminal stage.
   */
  advance?: string;
  /** Our reminder cadence. See the header — not a claimed authority SLA. */
  checkBackDays?: number;
  /** One line on what is happening now, shown under the label. */
  hint?: string;
}

/**
 * Default chain per archetype, so every one of the 71 tasks has a real chain
 * rather than a generic two-state placeholder. Tasks whose real-world flow is
 * distinctive override this below.
 */
const ARCHETYPE_CHAINS: Record<TaskArchetype, Stage[]> = {
  registration: [
    { id: "prepare", label: "אוספים את המסמכים", owner: "you", advance: "המסמכים מוכנים" },
    { id: "submit", label: "מוכן להגשה", owner: "you", advance: "הגשתי את הבקשה" },
    {
      id: "awaiting",
      label: "ממתין לאישור הרשות",
      owner: "them",
      advance: "קיבלתי תשובה",
      checkBackDays: 7,
      hint: "הכדור אצל הרשות. אין מה לעשות עד שמגיעה תשובה.",
    },
    { id: "registered", label: "התיק פתוח", owner: "done" },
  ],
  filing: [
    { id: "gather", label: "אוספים את נתוני התקופה", owner: "you", advance: "הנתונים מוכנים" },
    { id: "file", label: "מוכן לדיווח", owner: "you", advance: "דיווחתי" },
    {
      id: "pay",
      label: "דווח — ממתין לתשלום",
      owner: "you",
      advance: "שילמתי",
      hint: "הדיווח נרשם. חוב שלא שולם מצטבר ריבית והצמדה.",
    },
    { id: "settled", label: "דווח ושולם", owner: "done" },
  ],
  decision: [
    { id: "check", label: "בודקים אם נדרש", owner: "you", advance: "בדקתי — זה נדרש" },
    { id: "apply", label: "מגישים בקשה", owner: "you", advance: "הגשתי" },
    {
      id: "awaiting",
      label: "ממתין לתשובת הרשות",
      owner: "them",
      advance: "קיבלתי תשובה",
      checkBackDays: 14,
    },
    { id: "resolved", label: "הוכרע וטופל", owner: "done" },
  ],
  provider: [
    { id: "compare", label: "משווים אפשרויות", owner: "you", advance: "בחרתי ספק" },
    { id: "setup", label: "מגדירים את השירות", owner: "you", advance: "ההגדרה הושלמה" },
    { id: "active", label: "פעיל", owner: "done" },
  ],
  document: [
    { id: "draft", label: "מכינים את הנוסח", owner: "you", advance: "הנוסח מוכן" },
    { id: "deploy", label: "מטמיעים בפועל", owner: "you", advance: "הוטמע" },
    { id: "in_force", label: "בתוקף", owner: "done" },
  ],
  presence: [
    { id: "create", label: "יוצרים את הנכס", owner: "you", advance: "יצרתי" },
    { id: "verify", label: "מאמתים", owner: "you", advance: "אומת" },
    { id: "live", label: "באוויר", owner: "done" },
  ],
  calculator: [
    { id: "run", label: "ממלאים ומחשבים", owner: "you", advance: "חישבתי" },
    { id: "recorded", label: "חושב ומתועד", owner: "done" },
  ],
  routine: [
    { id: "define", label: "מגדירים את השגרה", owner: "you", advance: "הגדרתי" },
    { id: "first_run", label: "מריצים בפעם הראשונה", owner: "you", advance: "הרצתי" },
    { id: "running", label: "שגרה פעילה", owner: "done" },
  ],
};

/**
 * Per-task chains, where the real process differs from its archetype.
 *
 * Labels here are grounded in each template's own `after_submit`, which is the
 * reviewed, sourced description of what happens after you submit. That is
 * deliberate: the stage names must not assert a process the content does not
 * already describe.
 */
const TEMPLATE_CHAINS: Record<string, Stage[]> = {
  // after_submit: "בסיום מקבלים תעודת עוסק עם מספר העוסק — לרוב מיידית ועד כמה
  // ימי עסקים." So the wait is real but short, and what arrives is a specific
  // document with a number on it — which the completion flow already captures.
  "open-vat-file": [
    {
      id: "prepare",
      label: "אוספים מסמכים",
      owner: "you",
      advance: "המסמכים מוכנים",
      hint: "תעודת זהות, אסמכתת חשבון בנק ופרטי העסק.",
    },
    { id: "submit", label: "מוכן להגשה", owner: "you", advance: "הגשתי את הבקשה" },
    {
      id: "awaiting_certificate",
      label: "ממתין לתעודת עוסק",
      owner: "them",
      advance: "קיבלתי את התעודה",
      checkBackDays: 5,
      hint: "לרוב מיידי ועד כמה ימי עסקים.",
    },
    { id: "registered", label: "התיק פתוח ויש מספר עוסק", owner: "done" },
  ],

  "open-income-tax-file": [
    { id: "prepare", label: "אוספים מסמכים", owner: "you", advance: "המסמכים מוכנים" },
    { id: "submit", label: "מוכן להגשה", owner: "you", advance: "הגשתי" },
    {
      id: "awaiting_file",
      label: "ממתין לפתיחת התיק",
      owner: "them",
      advance: "התיק נפתח",
      checkBackDays: 7,
    },
    { id: "registered", label: "תיק מס הכנסה פתוח", owner: "done" },
  ],

  "open-bituach-leumi-file": [
    { id: "prepare", label: "ממלאים את הטופס", owner: "you", advance: "הטופס מוכן" },
    { id: "submit", label: "מוכן להגשה", owner: "you", advance: "הגשתי" },
    {
      id: "awaiting_classification",
      label: "ממתין לסיווג ולקביעת מקדמות",
      owner: "them",
      advance: "קיבלתי את הסיווג",
      checkBackDays: 14,
      hint: "הסיווג קובע את גובה המקדמות, ולכן שווה לבדוק שהוא נכון.",
    },
    { id: "registered", label: "מסווג ומשלם מקדמות", owner: "done" },
  ],

  "employer-deductions-file": [
    { id: "prepare", label: "אוספים פרטי העסק והעובדים", owner: "you", advance: "הפרטים מוכנים" },
    { id: "submit", label: "מוכן לפתיחת תיק ניכויים", owner: "you", advance: "הגשתי" },
    {
      id: "awaiting",
      label: "ממתין למספר תיק ניכויים",
      owner: "them",
      advance: "קיבלתי מספר תיק",
      checkBackDays: 10,
      hint: "בלי תיק ניכויים אין דרך חוקית לשלם שכר ולנכות מס.",
    },
    { id: "registered", label: "תיק ניכויים פעיל", owner: "done" },
  ],

  // A certificate with an expiry, not a one-off registration.
  "withholding-certificate": [
    { id: "check", label: "בודקים את המצב הנוכחי", owner: "you", advance: "בדקתי" },
    { id: "request", label: "מבקשים אישור", owner: "you", advance: "הגשתי בקשה" },
    {
      id: "awaiting",
      label: "ממתין לאישור ניכוי מס במקור",
      owner: "them",
      advance: "האישור התקבל",
      checkBackDays: 10,
      hint: "בלי אישור בתוקף, לקוחות מנכים בשיעור הגבוה.",
    },
    { id: "valid", label: "יש אישור בתוקף", owner: "done" },
  ],

  // Filings: the report and the payment are two different events, and a
  // reported-but-unpaid filing is the expensive middle state.
  "vat-reporting": [
    { id: "gather", label: "אוספים חשבוניות ותשומות", owner: "you", advance: "הנתונים מוכנים" },
    { id: "file", label: "מוכן לדיווח מע\"מ", owner: "you", advance: "דיווחתי" },
    {
      id: "pay",
      label: "דווח — ממתין לתשלום",
      owner: "you",
      advance: "שילמתי",
      hint: "איחור בתשלום צובר ריבית והצמדה מהיום הראשון.",
    },
    { id: "settled", label: "דווח ושולם", owner: "done" },
  ],

  "income-tax-advances": [
    { id: "gather", label: "אוספים את נתוני המחזור", owner: "you", advance: "הנתונים מוכנים" },
    { id: "file", label: "מוכן לדיווח מקדמה", owner: "you", advance: "דיווחתי" },
    { id: "pay", label: "דווח — ממתין לתשלום", owner: "you", advance: "שילמתי" },
    { id: "settled", label: "דווח ושולם", owner: "done" },
  ],

  "annual-tax-report": [
    { id: "gather", label: "אוספים את חומרי השנה", owner: "you", advance: "החומר מוכן" },
    {
      id: "accountant",
      label: "אצל רואה החשבון",
      owner: "them",
      advance: "הדוח חזור ומוכן",
      checkBackDays: 21,
      hint: "הכדור אצל המייצג. שווה לוודא שלא חסר לו חומר.",
    },
    { id: "file", label: "מוכן להגשה", owner: "you", advance: "הוגש" },
    { id: "settled", label: "הוגש", owner: "done" },
  ],

  // Municipal licensing: the long one, and the one people most need to see a
  // position in, because it can sit for months.
  "business-license": [
    { id: "check", label: "בודקים אם נדרש רישיון", owner: "you", advance: "בדקתי — נדרש" },
    { id: "prepare", label: "מכינים תוכניות ומסמכים", owner: "you", advance: "המסמכים מוכנים" },
    { id: "submit", label: "מוכן להגשה לרשות המקומית", owner: "you", advance: "הגשתי" },
    {
      id: "awaiting_inspection",
      label: "ממתין לביקורת ולאישורי גורמים",
      owner: "them",
      advance: "עברתי את הביקורות",
      checkBackDays: 30,
      hint: "כמה גורמים בודקים במקביל (כבאות, בריאות, הנדסה). זה לוקח זמן.",
    },
    {
      id: "awaiting_license",
      label: "ממתין לרישיון עצמו",
      owner: "them",
      advance: "הרישיון התקבל",
      checkBackDays: 21,
    },
    { id: "licensed", label: "יש רישיון בתוקף", owner: "done" },
  ],

  // Underwriting is a genuine third-party wait, unlike most provider tasks.
  "payment-solution": [
    { id: "compare", label: "משווים מסלולי סליקה", owner: "you", advance: "בחרתי ספק" },
    { id: "apply", label: "מגישים בקשה", owner: "you", advance: "הגשתי בקשה" },
    {
      id: "underwriting",
      label: "ממתין לאישור חיתום",
      owner: "them",
      advance: "אושרתי",
      checkBackDays: 5,
      hint: "הספק בודק את העסק לפני הפעלה.",
    },
    { id: "active", label: "סליקה פעילה", owner: "done" },
  ],

  "business-bank-account": [
    { id: "prepare", label: "אוספים מסמכים לבנק", owner: "you", advance: "המסמכים מוכנים" },
    { id: "apply", label: "פותחים חשבון", owner: "you", advance: "הגשתי בקשה" },
    {
      id: "awaiting",
      label: "ממתין לאישור הבנק",
      owner: "them",
      advance: "החשבון נפתח",
      checkBackDays: 7,
    },
    { id: "open", label: "חשבון עסקי פעיל", owner: "done" },
  ],

  // Verification is done BY Google, so it is a wait, not a step.
  "google-business-profile": [
    { id: "create", label: "יוצרים את הפרופיל", owner: "you", advance: "יצרתי" },
    {
      id: "awaiting_verification",
      label: "ממתין לאימות מול Google",
      owner: "them",
      advance: "האימות הושלם",
      checkBackDays: 14,
      hint: "האימות מגיע בדואר, בטלפון או בסרטון — תלוי בסוג העסק.",
    },
    { id: "live", label: "הפרופיל מאומת ובאוויר", owner: "done" },
  ],
};

/** The chain for a task: its own if it has one, otherwise its archetype's. */
export function chainFor(templateId: string): Stage[] {
  return TEMPLATE_CHAINS[templateId] ?? ARCHETYPE_CHAINS[resolveArchetype(templateId)];
}

/**
 * The stage a finished task sits on.
 *
 * Used by completeTask, which closes a task through the evidence flow rather
 * than through the tracker, and must still leave the chain consistent.
 */
export function terminalStageFor(templateId: string): string {
  const chain = chainFor(templateId);
  return chain[chain.length - 1].id;
}

/** True when this task's chain was authored for it specifically. */
export function hasBespokeChain(templateId: string): boolean {
  return templateId in TEMPLATE_CHAINS;
}

/**
 * The status a stage implies.
 *
 * One direction only: the stage decides the status, never the reverse. This is
 * what stops the two from disagreeing — the defect the audit found between the
 * home screen and the compliance engine, where two places computed "overdue"
 * from different inputs and one of them invented debts.
 */
export function statusForStage(chain: Stage[], index: number): TaskStatus {
  const stage = chain[index];
  if (!stage) return "todo";
  if (stage.owner === "done") return "done";
  if (stage.owner === "them") return "waiting";
  return index === 0 ? "todo" : "in_progress";
}

/**
 * Where a task sits in its chain.
 *
 * `stage` is authoritative when it resolves. It will not resolve for the rows
 * that existed before this feature, and it will not resolve if a chain is ever
 * re-authored with different ids — so both cases fall back to placing the task
 * by its stored status. That mapping is lossy by nature (a status cannot say
 * WHICH wait you are in), and it picks the earliest stage consistent with the
 * status, because overstating progress is the worse error in a compliance tool.
 */
export function stageIndexOf(
  task: { stage?: string | null; status: TaskStatus },
  chain: Stage[]
): number {
  // A closed task is at the end, whatever the stored stage says. completeTask
  // and this column are two writes, and if they ever disagree the task must not
  // render as still waiting on an authority — "done" is what every engine
  // (score, journey, compliance, reminders) reads, so it wins here.
  if (task.status === "done") return chain.length - 1;

  if (task.stage) {
    const found = chain.findIndex((s) => s.id === task.stage);
    if (found !== -1) return found;
  }

  switch (task.status) {
    case "waiting": {
      const firstWait = chain.findIndex((s) => s.owner === "them");
      // A chain with no external wait can still hold a legacy `waiting` row.
      // Place it on the last actionable stage rather than pretending it is done.
      return firstWait !== -1 ? firstWait : Math.max(0, chain.length - 2);
    }
    case "in_progress": {
      const second = chain.findIndex((s, i) => i > 0 && s.owner === "you");
      return second !== -1 ? second : 0;
    }
    default:
      return 0;
  }
}

export interface StagePosition {
  chain: Stage[];
  index: number;
  stage: Stage;
  /** 1-based, for "שלב 2 מתוך 4". */
  step: number;
  total: number;
  next: Stage | null;
  /** True when advancing from here should capture completion evidence. */
  advanceCompletes: boolean;
  /** Whether this row is positioned by a stored stage or guessed from status. */
  resolvedFromStage: boolean;
}

export function positionOf(task: {
  template_id: string;
  stage?: string | null;
  status: TaskStatus;
}): StagePosition {
  const chain = chainFor(task.template_id);
  const index = stageIndexOf(task, chain);
  const stage = chain[index] ?? chain[0];
  const next = chain[index + 1] ?? null;
  return {
    chain,
    index,
    stage,
    step: index + 1,
    total: chain.length,
    next,
    // The last advance hands over to the evidence flow rather than silently
    // closing the task: completion writes an audit event and, for several
    // tasks, real numbers onto the business card.
    advanceCompletes: next?.owner === "done",
    resolvedFromStage: Boolean(task.stage && chain.some((s) => s.id === task.stage)),
  };
}

/**
 * What the home screen should say about a task that is waiting on someone else.
 * Replaces the free-text the user used to type into a dialog.
 */
export function waitingLabelFor(task: {
  template_id: string;
  stage?: string | null;
  status: TaskStatus;
}): string {
  return positionOf(task).stage.label;
}

/**
 * The follow-up date to set when entering a stage, or null when that stage is
 * not a wait. Pure, so the date arithmetic is testable without a clock.
 */
export function checkBackDate(stage: Stage, todayIso: string): string | null {
  if (stage.owner !== "them" || !stage.checkBackDays) return null;
  const d = new Date(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + stage.checkBackDays);
  return d.toISOString().slice(0, 10);
}

/** Every stage id in the registry, for the invariant tests. */
export function allChains(): { key: string; chain: Stage[] }[] {
  return [
    ...Object.entries(ARCHETYPE_CHAINS).map(([key, chain]) => ({ key: `archetype:${key}`, chain })),
    ...Object.entries(TEMPLATE_CHAINS).map(([key, chain]) => ({ key, chain })),
  ];
}
