"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarClock,
  FolderOpen,
  History,
  LayoutDashboard,
  ListChecks,
  Plug,
  Settings,
  Store,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { pageTransition, spring } from "@/lib/motion";

const NAV = [
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard },
  { href: "/tasks", label: "המשימות", icon: ListChecks },
  { href: "/calendar", label: "לוח החובות", icon: CalendarClock },
  { href: "/tracking", label: "מעקב", icon: History },
  { href: "/insights", label: "תובנות", icon: BarChart3 },
  { href: "/business", label: "הפרופיל", icon: Briefcase },
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/integrations", label: "חיבורים", icon: Plug },
  { href: "/shop", label: "חנות", icon: Store },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

const MOBILE_NAV = NAV.filter((n) =>
  ["/dashboard", "/tasks", "/calendar", "/insights", "/business"].includes(n.href)
);

function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppShell({
  children,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-l md:border-edge md:bg-card/60 md:backdrop-blur-xl">
        <Link href="/dashboard" className="px-6 py-5">
          <span className="text-xl font-bold text-brand-strong">BizReady</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "text-brand-strong" : "text-ink-soft hover:bg-surface hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-desktop"
                    transition={spring}
                    className="absolute inset-0 -z-10 rounded-xl bg-brand-tint"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
          <Link
            href="/notifications"
            className={`relative mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/notifications")
                ? "text-brand-strong"
                : "text-ink-soft hover:bg-surface hover:text-ink"
            }`}
          >
            {pathname.startsWith("/notifications") && (
              <motion.span
                layoutId="nav-active-desktop"
                transition={spring}
                className="absolute inset-0 -z-10 rounded-xl bg-brand-tint"
              />
            )}
            <span className="relative">
              <Bell className="h-5 w-5" aria-hidden />
              <UnreadDot count={unreadCount} />
            </span>
            התראות
          </Link>
        </nav>
        <div className="border-t border-edge-soft px-3 py-3">
          <ThemeToggle />
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-edge bg-card/90 backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-lg font-bold text-brand-strong">BizReady</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/notifications"
              aria-label={`התראות${unreadCount > 0 ? `, ${unreadCount} חדשות` : ""}`}
              className="relative rounded-lg p-2 text-ink-soft"
            >
              <Bell className="h-5 w-5" aria-hidden />
              <UnreadDot count={unreadCount} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
        <motion.div
          key={pathname}
          variants={pageTransition}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8"
        >
          {children}
        </motion.div>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-card/95 backdrop-blur-xl md:hidden">
        <div className="flex justify-around">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium ${
                  active ? "text-brand-strong" : "text-ink-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-mobile"
                    transition={spring}
                    className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-brand-600"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
