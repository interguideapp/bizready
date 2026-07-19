"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Settings,
  Store,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard },
  { href: "/tasks", label: "המשימות", icon: ListChecks },
  { href: "/business", label: "כרטיס העסק", icon: Briefcase },
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/shop", label: "חנות", icon: Store },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

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
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-l md:border-slate-200 md:bg-white">
        <Link href="/dashboard" className="px-6 py-5">
          <span className="text-xl font-bold text-brand-700">BizReady</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
          <Link
            href="/notifications"
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/notifications")
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="relative">
              <Bell className="h-5 w-5" aria-hidden />
              <UnreadDot count={unreadCount} />
            </span>
            התראות
          </Link>
        </nav>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-lg font-bold text-brand-700">BizReady</span>
          <Link
            href="/notifications"
            aria-label={`התראות${unreadCount > 0 ? `, ${unreadCount} חדשות` : ""}`}
            className="relative rounded-lg p-2 text-slate-600"
          >
            <Bell className="h-5 w-5" aria-hidden />
            <UnreadDot count={unreadCount} />
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
          {children}
        </div>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="flex justify-around">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium ${
                  active ? "text-brand-700" : "text-slate-500"
                }`}
              >
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
