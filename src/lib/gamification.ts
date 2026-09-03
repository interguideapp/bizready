import type { TaskTemplate, TaskStatus } from "@/lib/types";
import { PRIORITY_WEIGHT } from "@/lib/types";

/**
 * Mature, dignified gamification — a "readiness" progression, not a game.
 * Pure & tested: XP + levels, milestone badges, a weekly streak, and a "wins"
 * list, all derived from existing task/event data (no new storage).
 */

export const XP_PER_WEIGHT = 10; // critical→30, important→20, recommended→10

export interface GamiTask {
  template_id: string;
  status: TaskStatus;
  is_relevant: boolean;
  completed_at?: string | null;
}

export interface GamiEvent {
  kind: string; // "completed" etc.
  created_at: string;
}

// ---------- levels ----------

const LEVELS: { min: number; title: string }[] = [
  { min: 0, title: "יוצאים לדרך" },
  { min: 60, title: "רשומים ופעילים" },
  { min: 160, title: "מדווחים כמו שצריך" },
  { min: 300, title: "עסק מבוסס" },
  { min: 480, title: "עסק מנוהל" },
];

export interface LevelInfo {
  level: number; // 1-based
  title: string;
  xp: number;
  levelFloor: number;
  nextAt: number | null; // xp needed for next level, null at max
  progress: number; // 0..1 within current level
  nextTitle: string | null;
}

export function computeXp(tasks: GamiTask[], templates: Map<string, TaskTemplate>): number {
  let xp = 0;
  for (const t of tasks) {
    if (!t.is_relevant || t.status !== "done") continue;
    const tpl = templates.get(t.template_id);
    if (!tpl) continue;
    xp += PRIORITY_WEIGHT[tpl.priority] * XP_PER_WEIGHT;
  }
  return xp;
}

export function levelFromXp(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.min - cur.min : 1;
  return {
    level: idx + 1,
    title: cur.title,
    xp,
    levelFloor: cur.min,
    nextAt: next ? next.min : null,
    progress: next ? Math.min(1, (xp - cur.min) / span) : 1,
    nextTitle: next ? next.title : null,
  };
}

// ---------- streak (consecutive weeks with a completion) ----------

function weekKey(d: Date): number {
  // number of whole weeks since epoch (UTC)
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 604_800_000);
}

/** Consecutive weeks (including the current one) that had a completion event. */
export function computeStreak(events: GamiEvent[], today: Date = new Date()): number {
  const weeks = new Set<number>();
  for (const e of events) {
    if (e.kind !== "completed") continue;
    weeks.add(weekKey(new Date(e.created_at)));
  }
  if (weeks.size === 0) return 0;
  const thisWeek = weekKey(today);
  // allow the streak to be "alive" if the last activity was this week or last week
  let cursor = weeks.has(thisWeek) ? thisWeek : thisWeek - 1;
  if (!weeks.has(cursor)) return 0;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

// ---------- wins ----------

export interface Win {
  templateId: string;
  title: string;
  categoryId: string;
  date: string | null;
}

export function computeWins(
  tasks: GamiTask[],
  templates: Map<string, TaskTemplate>
): Win[] {
  return tasks
    .filter((t) => t.is_relevant && t.status === "done" && templates.has(t.template_id))
    .map((t) => {
      const tpl = templates.get(t.template_id)!;
      return {
        templateId: t.template_id,
        title: tpl.title,
        categoryId: tpl.category_id,
        date: t.completed_at ?? null,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

// ---------- badges ----------

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide name
  earned: boolean;
}

export interface BadgeContext {
  tasks: GamiTask[];
  templates: Map<string, TaskTemplate>;
  stageOf: (categoryId: string) => string; // "setup" | "operating" | "growth"
  profilePercent: number;
  documentsCount: number;
  streak: number;
}

const STATUTORY = new Set(["vat-reporting", "income-tax-advances", "annual-tax-report"]);

export function computeBadges(ctx: BadgeContext): Badge[] {
  const { tasks, templates, stageOf, profilePercent, documentsCount, streak } = ctx;
  const relevant = tasks.filter((t) => t.is_relevant && templates.has(t.template_id));
  const doneIds = new Set(relevant.filter((t) => t.status === "done").map((t) => t.template_id));
  const isDone = (id: string) => doneIds.has(id);

  const stageComplete = (stage: string) => {
    const inStage = relevant.filter((t) => stageOf(templates.get(t.template_id)!.category_id) === stage);
    return inStage.length > 0 && inStage.every((t) => t.status === "done");
  };
  const allCriticalDone =
    relevant.some((t) => templates.get(t.template_id)!.priority === "critical") &&
    relevant
      .filter((t) => templates.get(t.template_id)!.priority === "critical")
      .every((t) => t.status === "done");
  const anyStatutoryDone = [...doneIds].some((id) => STATUTORY.has(id));

  const defs: Badge[] = [
    {
      id: "first-step",
      title: "הצעד הראשון",
      description: "השלמתם את המשימה הראשונה",
      icon: "Footprints",
      earned: doneIds.size >= 1,
    },
    {
      id: "registered",
      title: "רשומים כחוק",
      description: "פתחתם תיק עוסק במע\"מ",
      icon: "Landmark",
      earned: isDone("open-vat-file"),
    },
    {
      id: "setup-done",
      title: "הקמה הושלמה",
      description: "כל משימות שלב ההקמה סומנו כבוצעו",
      icon: "Rocket",
      earned: stageComplete("setup"),
    },
    {
      id: "reporting",
      title: "מדווחים בזמן",
      description: "השלמתם דיווח סטטוטורי (מע\"מ / מקדמות / שנתי)",
      icon: "FileCheck2",
      earned: anyStatutoryDone,
    },
    {
      id: "documented",
      title: "מתועדים",
      description: "יש לפחות מסמך אחד בארכיון",
      icon: "FolderCheck",
      earned: documentsCount >= 1,
    },
    {
      id: "profile-100",
      title: "פרופיל מושלם",
      description: "כרטיס העסק מלא ב-100%",
      icon: "BadgeCheck",
      earned: profilePercent >= 100,
    },
    {
      id: "all-critical",
      title: "כל החובות סגורות",
      description: "כל משימות החובה הקריטיות בוצעו",
      icon: "ShieldCheck",
      earned: allCriticalDone,
    },
    {
      id: "streak-4",
      title: "רצף של חודש",
      description: "4 שבועות רצופים של התקדמות",
      icon: "Flame",
      earned: streak >= 4,
    },
    {
      id: "growth",
      title: "פונים לצמיחה",
      description: "כל משימות שלב הצמיחה בוצעו",
      icon: "TrendingUp",
      earned: stageComplete("growth"),
    },
  ];
  return defs;
}
