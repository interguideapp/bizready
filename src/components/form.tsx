"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The form layer. There wasn't one.
 *
 * The audit counted ~19 distinct text-field styles, 4 checkbox implementations,
 * 42 button styles, 11 padding pairs and 4 disabled opacities across the app,
 * with three byte-identical private copies of the same `const field` string. No
 * field ever showed an error state, errors were unstyled sibling `<p>`s, and
 * there were zero `aria-live` regions anywhere in `src/`.
 *
 * The worst of it was on the most sensitive screen: `business/business-card.tsx`
 * renders 11 fields where the user types their VAT file number, income-tax file
 * number, national-insurance file number and BANK ACCOUNT — and every "label"
 * was a bare `<span>` with no `htmlFor` and no `id`. A screen reader announced
 * eleven unlabelled text boxes.
 *
 * So: labels are real `<label>` elements, wired by generated ids. Errors are
 * announced. Descriptions are linked with aria-describedby. Invalid fields carry
 * aria-invalid. None of this is optional on a screen that collects tax and bank
 * identifiers, and none of it can be got right by copying a class string.
 */

interface FieldContext {
  inputId: string;
  errorId: string;
  descriptionId: string;
  hasError: boolean;
  hasDescription: boolean;
}

const FieldCtx = createContext<FieldContext | null>(null);

/** Inside a Field, controls wire themselves up. Outside, they still work. */
function useField() {
  return useContext(FieldCtx);
}

/**
 * A labelled form row: label, optional description, control, and error.
 *
 * `label` is required. There is no prop for "no label" on purpose — an input
 * without an accessible name is a bug, and the type system is a better place to
 * say so than a code review.
 */
export function Field({
  label,
  description,
  error,
  required,
  /** Visually hide the label while keeping it for assistive tech. */
  labelHidden,
  className,
  children,
}: {
  label: string;
  description?: ReactNode;
  error?: string | null;
  required?: boolean;
  labelHidden?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const base = useId();
  const ctx: FieldContext = {
    inputId: `${base}-input`,
    errorId: `${base}-error`,
    descriptionId: `${base}-description`,
    hasError: Boolean(error),
    hasDescription: Boolean(description),
  };

  return (
    <FieldCtx.Provider value={ctx}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label
          htmlFor={ctx.inputId}
          className={cn(
            "text-sm font-medium text-ink-soft",
            labelHidden && "sr-only"
          )}
        >
          {label}
          {required && (
            <span className="ms-1 text-status-overdue" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only">(שדה חובה)</span>}
        </label>

        {description && (
          <p id={ctx.descriptionId} className="text-xs leading-relaxed text-ink-muted">
            {description}
          </p>
        )}

        {children}

        {/*
          role="alert" rather than a plain aria-live region: a validation failure
          is the one thing on the screen the user must hear about immediately,
          and this is the app's first announced error of any kind.
        */}
        <p
          id={ctx.errorId}
          role="alert"
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-status-overdue",
            !error && "hidden"
          )}
        >
          {error && (
            <>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {error}
            </>
          )}
        </p>
      </div>
    </FieldCtx.Provider>
  );
}

/** The shared control surface. One definition, not nineteen. */
const CONTROL =
  "w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted " +
  "outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
const CONTROL_OK = "border-edge focus:border-brand-500 focus:ring-brand-edge";
const CONTROL_ERR =
  "border-status-overdue focus:border-status-overdue focus:ring-status-overdue/30";

function controlClasses(hasError: boolean, className?: string) {
  return cn(CONTROL, hasError ? CONTROL_ERR : CONTROL_OK, className);
}

/** aria wiring derived from the surrounding Field. */
function ariaProps(ctx: FieldContext | null) {
  if (!ctx) return {};
  const describedBy = [
    ctx.hasDescription ? ctx.descriptionId : null,
    ctx.hasError ? ctx.errorId : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: ctx.inputId,
    "aria-invalid": ctx.hasError || undefined,
    "aria-describedby": describedBy || undefined,
  };
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const ctx = useField();
    return (
      <input
        ref={ref}
        {...ariaProps(ctx)}
        className={controlClasses(Boolean(ctx?.hasError), className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const ctx = useField();
  return (
    <textarea
      ref={ref}
      {...ariaProps(ctx)}
      className={controlClasses(Boolean(ctx?.hasError), cn("min-h-24 resize-y", className))}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }
>(({ className, options, ...props }, ref) => {
  const ctx = useField();
  return (
    <select
      ref={ref}
      {...ariaProps(ctx)}
      // appearance-none plus an explicit padding-end leaves room for the native
      // arrow on the correct side in RTL.
      className={controlClasses(Boolean(ctx?.hasError), cn("pe-8", className))}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
Select.displayName = "Select";

/**
 * A checkbox with a real label and a 44px hit area.
 *
 * There were four separate checkbox implementations, two of them fake
 * checkboxes built from divs — so a keyboard user could not reach them and a
 * screen reader was told nothing about their state.
 */
export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const descId = `${id}-description`;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-edge bg-card outline-none transition checked:border-brand-600 checked:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-edge disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Check
          className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1 py-2.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink-soft">
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A form-level message, for the failure that is not about one field — "the save
 * did not go through".
 *
 * This exists because the app had no way to say that. `business-card.tsx`
 * awaited a server action that THROWS on error and then called
 * `toast.success(...)`, so a failed save produced an unhandled rejection and the
 * user was left staring at a form that looked like it had not been submitted,
 * with no message at all.
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed",
        tone === "error"
          ? "border-status-overdue/30 bg-status-overdue-bg text-ink-soft"
          : "border-status-done/30 bg-status-done-bg text-ink-soft"
      )}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-overdue" aria-hidden />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-done" aria-hidden />
      )}
      <span>{children}</span>
    </p>
  );
}
