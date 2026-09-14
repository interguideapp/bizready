import { startsWithIsoDate, todayInIsrael } from "@/lib/dates";

/**
 * One reading of `completion_data.renewal`, the expiry a user types when they
 * finish an insurance, licence or certificate task.
 *
 * Its own module because THREE engines read that field and each read it
 * differently. cycles.ts required a strict yyyy-mm-dd; compliance.ts accepted
 * anything `new Date()` could parse and then reformatted it, so a value like
 * "2026" was an obligation to the board and invisible to the reminder sweep.
 * compliance.ts cannot import cycles.ts (cycles.ts imports the filing rules
 * from it), so neither was in a position to own the answer.
 */

/** Strictly a yyyy-mm-dd, or null. Anything looser is a typo, not a date. */
export function renewalDateOf(task: {
  completion_data?: Record<string, unknown> | null;
}): string | null {
  const raw = task.completion_data?.renewal;
  if (!startsWithIsoDate(raw)) return null;
  const d = new Date(raw.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : raw.slice(0, 10);
}

/**
 * The renewal expiry still worth tracking, or null once the user has dealt
 * with it.
 *
 * The distinction all three readers were missing. A renewal date is captured at
 * completion and then MERGED on every later completion, so re-finishing the
 * task without touching the optional date field keeps the old expiry — and
 * every reader treated that stale date as cover that had lapsed. The result was
 * a renewal nobody could ever clear: buy the new policy, mark the task done,
 * and the board says the cover expired, permanently.
 *
 * A completion on or after the expiry closed that period. The user renewed and
 * said so by finishing the task again, so the stale date is evidence of the
 * cover that ended, not a duty that is open.
 *
 * Compared on the ISRAEL calendar day, because completed_at is a UTC instant:
 * a policy expiring on the 2nd must not read as still open to someone who
 * renewed it at 01:00 local on the 2nd.
 */
export function openRenewalOf(task: {
  completion_data?: Record<string, unknown> | null;
  completed_at?: string | null;
}): string | null {
  const renewal = renewalDateOf(task);
  if (!renewal) return null;
  if (task.completed_at && todayInIsrael(new Date(task.completed_at)) >= renewal) return null;
  return renewal;
}
