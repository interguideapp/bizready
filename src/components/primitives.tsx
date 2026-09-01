"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Drawer } from "vaul";
import * as Accordion from "@radix-ui/react-accordion";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChevronDown, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background,color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-edge active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-e-brand hover:bg-brand-700",
  secondary:
    "border border-edge bg-card text-ink-soft backdrop-blur-xl hover:border-brand-300 hover:text-brand-strong",
  ghost: "text-ink-soft hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-status-overdue text-white hover:opacity-90",
  success: "bg-status-done text-white hover:opacity-90",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, icon, fullWidth, className, children, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

// ---------- SegmentedControl ----------

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex w-full rounded-2xl border border-edge bg-surface-2 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active ? "text-white" : "text-ink-muted hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId="segmented-active"
                transition={spring}
                className="absolute inset-0 -z-10 rounded-xl bg-brand-600 shadow-e-brand"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Sheet (mobile bottom sheet via vaul) ----------

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92vh] flex-col rounded-t-3xl border-t border-edge bg-card-solid outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-edge-strong" />
          {title && (
            <Drawer.Title className="px-5 pt-3 text-lg font-bold text-ink">
              {title}
            </Drawer.Title>
          )}
          <div className="overflow-y-auto px-5 pb-8 pt-3">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ---------- Accordion ----------

export function AccordionRoot({
  children,
  className,
  defaultValue,
}: {
  children: ReactNode;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultValue}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {children}
    </Accordion.Root>
  );
}

export function AccordionItem({
  value,
  trigger,
  children,
}: {
  value: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-2xl border border-edge bg-card shadow-e1"
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-edge">
          {trigger}
          <ChevronDown
            className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-acc-up data-[state=open]:animate-acc-down">
        <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-ink-soft">
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

// ---------- Popover (e.g. "why this date?") ----------

export function InfoPopover({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-2xl border border-edge bg-card-solid p-4 text-sm leading-relaxed text-ink-soft shadow-e3 outline-none data-[state=open]:animate-pop-in"
        >
          {children}
          <Popover.Arrow className="fill-[var(--card-solid)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------- Tooltip ----------

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-surface shadow-e2 data-[state=delayed-open]:animate-pop-in"
          >
            {label}
            <Tooltip.Arrow className="fill-[var(--ink)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---------- Progress ring (compact, animated) ----------

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-strong)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={spring}
        />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-ink-soft">
          {children}
        </span>
      )}
    </span>
  );
}

export { X as CloseIcon };
