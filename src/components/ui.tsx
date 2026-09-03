import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// re-exported primitives so "@/components/ui" is the single barrel
export {
  Button,
  SegmentedControl,
  Sheet,
  AccordionRoot,
  AccordionItem,
  InfoPopover,
  Hint,
  ProgressRing,
} from "@/components/primitives";
export { FadeIn, Stagger, AnimatedNumber, MotionProvider } from "@/components/motion";

export function Card({
  children,
  className = "",
  elevated = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "panel rounded-card",
        elevated && "shadow-e2",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-e-brand",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A small labeled pill. Presentational; pass tone for color. */
export function Chip({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "done" | "progress" | "overdue";
  icon?: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-muted",
    brand: "bg-brand-tint text-brand-strong",
    done: "bg-status-done-bg text-status-done",
    progress: "bg-status-progress-bg text-status-progress",
    overdue: "bg-status-overdue-bg text-status-overdue",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Loading placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

/** A compact stat block: big value + label. */
export function Stat({
  value,
  label,
  icon,
  tone,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  tone?: "overdue";
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-0.5 px-2 py-3 text-center",
        tone === "overdue" && "ring-1 ring-status-overdue/30"
      )}
    >
      <span className="tnum flex items-center gap-1.5 text-lg font-bold text-ink">
        {icon}
        {value}
      </span>
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
    </Card>
  );
}

export function PageTitle({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
      <h1 className="text-title text-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 text-ink-muted">{subtitle}</p>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand-strong">
        {icon}
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {subtitle && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{subtitle}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
      המידע ב-BizReady הוא מידע כללי בלבד ואינו מהווה ייעוץ משפטי, מיסויי או
      פיננסי. לפני החלטות מהותיות מומלץ להתייעץ עם איש מקצוע מוסמך.
    </p>
  );
}
