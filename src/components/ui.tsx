import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-edge/80 bg-card shadow-sm backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
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
