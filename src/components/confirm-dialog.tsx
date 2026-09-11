"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/primitives";

/**
 * A real confirmation dialog, replacing `window.confirm`.
 *
 * `confirm()` renders the browser's own chrome: left-to-right, with OS-language
 * buttons ("OK" / "Cancel" in English on a Hebrew system), unstyleable, and
 * completely outside the product's visual language. In an RTL app it breaks the
 * illusion the moment a user tries to delete anything — and it was guarding two
 * destructive actions: deleting an archived document and disconnecting an
 * integration.
 *
 * `@radix-ui/react-dialog` was already in package.json and imported by nothing.
 * It brings focus trapping, Escape to dismiss, `aria-modal`, and focus returned
 * to the trigger — all of which `confirm()` gets from the browser and a
 * hand-rolled div does not get at all.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  destructive,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          dir="rtl"
          className="fixed start-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-edge bg-card-solid p-6 shadow-e3 rtl:translate-x-1/2"
        >
          <div className="mb-3 flex items-start gap-3">
            {destructive && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-overdue-bg text-status-overdue">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-section text-ink">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-relaxed text-ink-muted">
                {body}
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={onConfirm}
              loading={pending}
            >
              {confirmLabel}
            </Button>
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Hook form for the common case: a destructive button that needs one
 * confirmation. Keeps call sites from each inventing their own open state.
 *
 * Usage:
 *   const del = useConfirm(() => remove(id));
 *   <button onClick={del.ask}>…</button>
 *   {del.dialog({ title: "…", body: "…", destructive: true })}
 */
export function useConfirm(action: () => void) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return {
    ask: () => setOpen(true),
    dialog: (
      props: Omit<
        Parameters<typeof ConfirmDialog>[0],
        "open" | "onOpenChange" | "onConfirm" | "pending"
      >
    ) => (
      <ConfirmDialog
        {...props}
        open={open}
        pending={pending}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        onConfirm={() => {
          setPending(true);
          try {
            action();
          } finally {
            setPending(false);
            setOpen(false);
          }
        }}
      />
    ),
  };
}
