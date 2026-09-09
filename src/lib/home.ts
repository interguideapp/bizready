/**
 * The glass "home OS" screen logic — pure & tested. Produces the time-aware
 * greeting and the "אפשר עכשיו" quick-wins list: small, low-friction actions a
 * user can finish in a couple of minutes, so opening the app always has an easy,
 * rewarding thing to do (the daily-engagement hook) beyond the big tasks that
 * take days to be approved.
 */

/** Time-aware Hebrew greeting for a given local hour (0–23). */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 18) return "צהריים טובים";
  if (hour >= 18 && hour < 22) return "ערב טוב";
  return "לילה טוב";
}

export interface QuickWin {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  minutes: number;
  icon: string; // lucide name resolved in the view
}

export interface QuickWinContext {
  hasIncome: boolean;
  profilePercent: number;
  documentsCount: number;
  productsCount: number;
  loggedIncomeThisMonth: boolean;
  /** available, low-effort tasks (not locked/done) — already ranked by the caller */
  shortTasks: { templateId: string; title: string; minutes: number }[];
}

/**
 * Build up to `limit` quick wins, cheapest-first. Data-completeness actions come
 * before task actions because they take seconds and immediately sharpen the rest
 * of the system (income → set-aside, profile → readiness).
 */
export function buildQuickWins(ctx: QuickWinContext, limit = 4): QuickWin[] {
  const wins: QuickWin[] = [];

  if (!ctx.hasIncome || !ctx.loggedIncomeThisMonth) {
    wins.push({
      id: "log-income",
      label: "רשמו את הכנסת החודש",
      sublabel: "וקבלו מיד תחזית הפרשה למיסים",
      href: "/insights",
      minutes: 2,
      icon: "Wallet",
    });
  }
  if (ctx.profilePercent < 100) {
    wins.push({
      id: "complete-profile",
      label: "השלימו פרט בתיק העסק",
      sublabel: `הפרופיל ב-${ctx.profilePercent}% — עוד קצת והוא מלא`,
      href: "/business",
      minutes: 3,
      icon: "UserRound",
    });
  }
  if (ctx.documentsCount === 0) {
    wins.push({
      id: "upload-doc",
      label: "העלו מסמך ראשון",
      sublabel: "תעודת עוסק, אישור או חוזה — שיהיה במקום אחד",
      href: "/documents",
      minutes: 2,
      icon: "FolderOpen",
    });
  }
  if (ctx.productsCount === 0) {
    wins.push({
      id: "add-product",
      label: "הוסיפו מוצר או שירות",
      sublabel: "הבסיס למחירון ולחשבוניות",
      href: "/shop",
      minutes: 3,
      icon: "Store",
    });
  }
  for (const t of ctx.shortTasks) {
    if (wins.length >= limit) break;
    wins.push({
      id: `task:${t.templateId}`,
      label: t.title,
      sublabel: "משימה קצרה שאפשר לסגור עכשיו",
      href: `/tasks/${t.templateId}`,
      minutes: t.minutes,
      icon: "Zap",
    });
  }

  return wins.slice(0, limit);
}

/** Parse a rough minute estimate out of a free-text est_time; null if unknown. */
export function estMinutes(estTime: string | undefined): number | null {
  if (!estTime) return null;
  // "5 דקות", "רבע שעה", "כשעה", "10–15 דקות", "30–60 דקות"
  if (/רבע שעה/.test(estTime)) return 15;
  if (/חצי שעה/.test(estTime)) return 30;
  if (/כשעה|שעה/.test(estTime) && !/דקות/.test(estTime)) return 60;
  const m = estTime.match(/(\d+)\s*(–|-)?\s*(\d+)?\s*דק/);
  if (m) return Number(m[1]);
  return null;
}

/** Is this task a quick win? (short and light). */
export function isQuickTask(minutes: number | null): boolean {
  return minutes != null && minutes <= 20;
}
