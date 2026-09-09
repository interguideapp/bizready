"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Command } from "lucide-react";
import { pageTransition } from "@/lib/motion";
import { Dock } from "@/components/dock";

export function AppShell({
  children,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const fullBleed = pathname === "/home";

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* slim top bar — the OS "menu bar". Hidden on the home lock-screen,
          which carries its own status bar. */}
      {!fullBleed && (
        <header className="sticky top-0 z-20 border-b border-edge/70 bg-card/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-3xl items-center px-4 md:px-8">
            <Link href="/home" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-to text-white shadow-e-brand">
                <Command className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="text-lg font-bold text-gradient">BizReady</span>
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1">
        {fullBleed ? (
          <motion.div key={pathname} variants={pageTransition} initial="hidden" animate="show">
            {children}
          </motion.div>
        ) : (
          <motion.div
            key={pathname}
            variants={pageTransition}
            initial="hidden"
            animate="show"
            className="mx-auto w-full max-w-3xl px-4 pb-36 pt-6 md:px-8"
          >
            {children}
          </motion.div>
        )}
      </main>

      {/* the dock — global bottom navigation */}
      <Dock unreadCount={unreadCount} />
    </div>
  );
}
