"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Where "back" actually goes.
 *
 * The task page hardcoded `href="/tasks"` with the label "כל המשימות", and it
 * is reachable from /home, /tracking, /notifications, /insights, /documents and
 * /calendar as well — so the link was wrong on six of seven entry points, and
 * it discarded the `?category=` filter a user had set on the way in.
 *
 * The fix uses the two signals that are actually available on the client:
 *
 * 1. An explicit `?from=` on the URL, when the linking page sets one. That is
 *    the reliable signal and it survives a reload.
 * 2. Otherwise `router.back()`, which returns the user where they came from
 *    even when nobody annotated the link.
 *
 * It falls back to a real `<Link href="/tasks">` when there is no history to go
 * back to — a fresh tab, or a shared URL. That matters: `router.back()` in a
 * fresh tab does nothing at all, which is the one outcome worse than going to
 * the wrong page.
 *
 * `ArrowRight` is "back" here because the document is RTL: back points toward
 * the start edge, which is the right. The same file used to use ArrowRight for
 * both back and forward, in two places, twelve lines apart.
 */

/** Pages a task can be reached from, and what "back" should say for each. */
const ORIGINS: Record<string, { href: string; label: string }> = {
  home: { href: "/home", label: "לבית" },
  tasks: { href: "/tasks", label: "כל המשימות" },
  calendar: { href: "/calendar", label: "ללוח החובות" },
  tracking: { href: "/tracking", label: "למעקב הפעילות" },
  notifications: { href: "/notifications", label: "להתראות" },
  insights: { href: "/insights", label: "לתובנות" },
  documents: { href: "/documents", label: "למסמכים" },
};

export function TaskBackLink() {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get("from");
  const category = params.get("category");
  const origin = from ? ORIGINS[from] : undefined;

  const className =
    "mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted transition hover:text-ink";

  // An annotated origin is the reliable case: it names the destination and
  // survives a reload, and it preserves the filter the user arrived with.
  if (origin) {
    const href = category
      ? `${origin.href}?category=${encodeURIComponent(category)}`
      : origin.href;
    return (
      <Link href={href} className={className}>
        <ArrowRight className="h-4 w-4" aria-hidden />
        {origin.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // No history means a fresh tab or a shared link, where back() is a
        // no-op. Going to the task list is a worse guess than going back, and
        // a much better one than doing nothing.
        if (window.history.length > 1) router.back();
        else router.push("/tasks");
      }}
      className={className}
    >
      <ArrowRight className="h-4 w-4" aria-hidden />
      חזרה
    </button>
  );
}
