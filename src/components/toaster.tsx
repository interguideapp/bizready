"use client";

import { Toaster as Sonner } from "sonner";

/**
 * App toaster. Themed to our tokens and RTL. Mounted once in the root layout;
 * call `toast(...)` from "sonner" anywhere (client) to show feedback.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      dir="rtl"
      toastOptions={{
        style: {
          background: "color-mix(in srgb, var(--card) 82%, transparent)",
          color: "var(--ink)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.22), var(--elev-3)",
          borderRadius: "1.1rem",
          backdropFilter: "blur(28px) saturate(1.8)",
          WebkitBackdropFilter: "blur(28px) saturate(1.8)",
          fontFamily: "var(--font-heebo), Heebo, system-ui, sans-serif",
        },
      }}
    />
  );
}

export { toast } from "sonner";
