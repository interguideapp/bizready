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
          background: "var(--card-solid)",
          color: "var(--ink)",
          border: "1px solid var(--edge)",
          boxShadow: "var(--elev-3)",
          borderRadius: "1rem",
          fontFamily: "var(--font-heebo), Heebo, system-ui, sans-serif",
        },
      }}
    />
  );
}

export { toast } from "sonner";
