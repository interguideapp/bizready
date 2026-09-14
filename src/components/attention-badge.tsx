import { getBusiness } from "@/lib/data";
import { loadAttentionCount } from "@/lib/attention";

/**
 * The dock's unread count, rendered on its own so navigation need not wait.
 *
 * WHY THIS IS A SEPARATE COMPONENT. The (app) layout used to await
 * loadAttentionCount before returning any markup, and that call is five
 * Supabase queries plus a reminders computation over every task. Every
 * navigation in the product paid it, to decide one digit on one icon — and
 * with the database in eu-central-1 while the functions ran in iad1, each of
 * those queries was a transatlantic round trip.
 *
 * Behind a Suspense boundary the page arrives first and the number follows.
 * Nobody is waiting to read a badge, and nothing on any screen depends on it:
 * the count is a prompt to open /notifications, and that page derives its own
 * list from scratch on load.
 *
 * getBusiness is request-cached, so asking for it again here costs nothing.
 */
export async function AttentionBadge() {
  const business = await getBusiness();
  if (!business) return null;

  const unread = await loadAttentionCount(business);
  if (unread <= 0) return null;

  return (
    <span className="absolute start-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue px-1 text-xs font-bold text-white">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
