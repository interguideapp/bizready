import {
  REMINDER_WINDOWS_FREE,
  REMINDER_WINDOWS_PRO,
  REMINDER_WINDOWS_RECOMMENDED,
} from "@/lib/compliance";
import { horizonLabel } from "@/lib/he-distance";

/**
 * How far ahead the alerts page has ACTUALLY looked — which is not one number.
 *
 * The empty state says "בדקנו את המשימות שלכם עכשיו — אין דדליין …", and the
 * horizon it named was Math.max of the plan's windows: 30 days on Pro.
 *
 * But the escalation was deliberately narrowed by kind. Statutory filings and
 * document expiries get the full runway; a RECOMMENDATION gets a single nudge
 * at seven days, because four nudges per suggestion across forty tasks is how
 * an alerts list becomes something people stop opening. That narrowing was
 * measured — thirteen of thirteen alerts either live business had ever
 * received were recommended setup tasks.
 *
 * So for a Pro user with a recommended task dated twenty days out, the page
 * said "אין דדליין בחודש הקרוב" and there was one. Not a wrong row: a wrong
 * ALL-CLEAR, on the screen whose entire job is that nothing gets missed, and
 * produced by the fix for a different problem. The page's own docstring warns
 * about exactly this shape one level up ("an empty list means nothing inside
 * that horizon, not nothing at all") — the copy was updated for the plan's
 * horizon and not for the per-kind one.
 *
 * Two numbers, so the sentence can be true of both. When they coincide — the
 * free plan, where everything is seven days — it collapses to one clause,
 * because a sentence that says the same thing twice reads as a mistake.
 */
export interface AlertHorizon {
  /** Days ahead statutory filings and expiries are raised from. */
  statutory: number;
  /** Days ahead a recommendation is raised from. Never escalates. */
  recommended: number;
}

export function alertHorizon(pro: boolean): AlertHorizon {
  const windows = pro ? REMINDER_WINDOWS_PRO : REMINDER_WINDOWS_FREE;
  return {
    statutory: Math.max(...windows),
    recommended: Math.max(...REMINDER_WINDOWS_RECOMMENDED),
  };
}

/**
 * The clause naming what was checked, honest for every kind.
 *
 * Deliberately not the widest horizon, and deliberately not the narrowest
 * either: the first over-promises and the second would tell a Pro user we had
 * only looked a week ahead when we had looked a month ahead for the filings
 * that carry penalties.
 */
export function horizonSentence(h: AlertHorizon): string {
  if (h.statutory === h.recommended) {
    return `אין דדליין ${horizonLabel(h.statutory)}`;
  }
  return `אין הגשה או תפוגה ${horizonLabel(
    h.statutory
  )}, אין משימה מומלצת ${horizonLabel(h.recommended)}`;
}
