"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { IdCard, Briefcase, FolderOpen } from "lucide-react";

/**
 * "תיק העסק" is one hub, not three menu items. These tabs unify the passport
 * overview, the business details/profile, and the documents vault under a single
 * roof — so the dock carries one entry instead of three.
 */
const TABS = [
  { href: "/passport", label: "סקירה", icon: IdCard },
  { href: "/business", label: "פרטי העסק", icon: Briefcase },
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
];

export function BusinessHubTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 rounded-2xl border border-white/8 bg-card/40 p-1 backdrop-blur-xl">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="hub-tab-active"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 shadow-e-brand"
              />
            )}
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
