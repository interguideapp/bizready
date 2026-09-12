import { TEMPLATES_BY_ID } from "@/lib/content";
import { getBusinessTasks, getFiledPeriods, getNotifications } from "@/lib/data";
import { computeReminders } from "@/lib/reminders";
import { mergeAttention, unreadCount, type AttentionItem } from "@/lib/live-attention";
import { isPro } from "@/lib/subscription";
import { profileOf } from "@/lib/tasks-live";
import type { BusinessRow } from "@/lib/data";

/**
 * Everything that needs attention, for a business, right now.
 *
 * One loader so every surface counts the same things. The dock badge used to
 * read the `notifications` table alone, which meant that when the nightly sweep
 * was not running the badge said zero while a statutory filing sat overdue —
 * and with no badge, no reason to open the page that would have said so.
 *
 * The reads are memoised per request (React cache in data.ts), so the layout
 * asking for this and the page below it asking for the same tasks costs one
 * query, not two.
 */
export async function loadAttention(business: BusinessRow): Promise<AttentionItem[]> {
  const [stored, tasks, filedPeriods] = await Promise.all([
    getNotifications(business.id),
    getBusinessTasks(business.id),
    getFiledPeriods(business.id),
  ]);

  // Deliberately the STORED rows, not the cycle-projected ones from
  // loadLiveTasks. This list is "what the sweep would have sent", so it has to
  // be fed exactly what the sweep is fed — otherwise a newly opened reporting
  // period, which the projection has already turned into an open task, would
  // never produce its "תקופת דיווח חדשה" item here.
  const { notifications: drafts } = computeReminders(
    tasks.map((t) => ({
      id: t.id,
      template_id: t.template_id,
      status: t.status,
      is_relevant: t.is_relevant,
      dismissal: t.dismissal ?? null,
      due_date: t.due_date,
      personal_due_date: t.personal_due_date ?? null,
      completed_at: t.completed_at,
      completion_data: t.completion_data ?? null,
      filed_periods: filedPeriods.get(t.template_id),
      follow_up_date: t.follow_up_date ?? null,
      waiting_for: t.waiting_for ?? null,
    })),
    TEMPLATES_BY_ID,
    new Date(),
    isPro(business),
    profileOf(business)
  );

  return mergeAttention(stored, drafts);
}

/** What the dock badge should show. */
export async function loadAttentionCount(business: BusinessRow): Promise<number> {
  return unreadCount(await loadAttention(business));
}
