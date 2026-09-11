"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Command } from "lucide-react";
import { pageTransition } from "@/lib/motion";
import { useLiquidGlass } from "@/lib/use-liquid-glass";
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
  const rootRef = useRef<HTMLDivElement>(null);
  useLiquidGlass(rootRef);

  return (
    <div ref={rootRef} className="relative flex min-h-screen flex-col overflow-x-hidden">
      {/* the living OS wallpaper — one layer behind every screen */}
      <div className="os-ambient" aria-hidden />

      {/* slim top bar — the OS "menu bar". Hidden on the home lock-screen,
          which carries its own status bar. */}
      {!fullBleed && (
        <header className="sticky top-0 z-30 border-b border-white/5 bg-card/50 backdrop-blur-2xl">
          <div className="mx-auto flex h-14 max-w-3xl items-center px-4 md:px-8 lg:max-w-5xl xl:max-w-6xl">
            <Link href="/home" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-to text-white shadow-e-brand">
                <Command className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="text-lg font-bold text-gradient">BizReady</span>
            </Link>
          </div>
        </header>
      )}

      <main
        className="relative z-10 flex-1"
        style={{
          transform: "translate3d(var(--par-x2, 0), var(--par-y2, 0), 0)",
          transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
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
            className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-10 lg:max-w-5xl xl:max-w-6xl"
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
