"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarClock,
  FolderOpen,
  History,
  Home,
  IdCard,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Plug,
  Settings,
  Store,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const PRIMARY: Item[] = [
  { href: "/home", label: "בית", icon: Home },
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard },
  { href: "/tasks", label: "המשימות", icon: ListChecks },
  { href: "/calendar", label: "לוח החובות", icon: CalendarClock },
  { href: "/passport", label: "תיק העסק", icon: IdCard },
  { href: "/insights", label: "תובנות", icon: BarChart3 },
];

const SECONDARY: Item[] = [
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/business", label: "הפרופיל", icon: Briefcase },
  { href: "/tracking", label: "מעקב", icon: History },
  { href: "/shop", label: "חנות", icon: Store },
  { href: "/integrations", label: "חיבורים", icon: Plug },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

/** macOS-style dock: pointer magnification, spring physics, a breathing halo. */
export function Dock({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const mouseX = useMotionValue(Infinity);
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-5">
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* click-away */}
            <div
              className="pointer-events-auto fixed inset-0 z-0"
              onClick={() => setMoreOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="dock-bar pointer-events-auto absolute bottom-[88px] z-10 w-[min(92vw,320px)] p-2"
            >
              <div className="grid grid-cols-2 gap-1">
                {SECONDARY.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                        active ? "bg-brand-tint text-brand-strong" : "text-ink-soft hover:bg-white/5 hover:text-ink"
                      }`}
                    >
                      <it.icon className="h-4.5 w-4.5" aria-hidden />
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.nav
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.1 }}
        className="dock-bar pointer-events-auto relative flex items-end gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-3"
        aria-label="ניווט ראשי"
      >
        <span className="dock-halo" aria-hidden />
        {PRIMARY.map((it) => (
          <DockButton key={it.href} mouseX={mouseX} item={it} active={isActive(it.href)} />
        ))}

        {/* notifications */}
        <DockButton
          mouseX={mouseX}
          item={{ href: "/notifications", label: "התראות", icon: Bell }}
          active={isActive("/notifications")}
          badge={unreadCount}
        />

        {/* divider */}
        <span className="mx-0.5 mb-2 h-8 w-px shrink-0 self-center bg-white/10" aria-hidden />

        {/* more */}
        <DockButton
          mouseX={mouseX}
          item={{ href: "#more", label: "עוד", icon: LayoutGrid }}
          active={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        />
      </motion.nav>
    </div>
  );
}

function DockButton({
  mouseX,
  item,
  active,
  badge = 0,
  onClick,
}: {
  mouseX: MotionValue<number>;
  item: Item;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect();
    if (!b) return 9999;
    return val - (b.x + b.width / 2);
  });
  const sizeTarget = useTransform(distance, [-110, 0, 110], [36, 60, 36]);
  const size = useSpring(sizeTarget, { mass: 0.1, stiffness: 200, damping: 15 });
  const iconTarget = useTransform(distance, [-110, 0, 110], [17, 27, 17]);
  const iconSize = useSpring(iconTarget, { mass: 0.1, stiffness: 200, damping: 15 });

  const Icon = item.icon;
  const content = (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.86 }}
      className={`relative flex aspect-square items-center justify-center rounded-2xl transition-colors ${
        active ? "bg-brand-tint text-brand-strong" : "text-ink-soft hover:text-ink"
      }`}
    >
      <motion.span
        key={active ? "active" : "idle"}
        initial={{ y: active ? -7 : 0, scale: active ? 0.82 : 1 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        style={{ width: iconSize, height: iconSize }}
        className="flex items-center justify-center"
      >
        <Icon className="h-full w-full" />
      </motion.span>

      {badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue px-1 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}

      {/* active dot */}
      {active && (
        <motion.span
          layoutId="dock-active"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute -bottom-1 h-1 w-1 rounded-full bg-brand-strong"
        />
      )}

      {/* label tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-lg border border-white/10 bg-card px-2.5 py-1 text-[11px] font-medium text-ink shadow-lg backdrop-blur-xl"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={item.label} className="shrink-0">
        {content}
      </button>
    );
  }
  return (
    <Link href={item.href} aria-label={item.label} className="shrink-0">
      {content}
    </Link>
  );
}
