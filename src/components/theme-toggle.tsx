"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. The initial theme is applied before paint by an inline
 * script in the root layout; this component just flips and persists it.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
      className={`rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {isDark === null ? (
        <Sun className="h-5 w-5 opacity-0" aria-hidden />
      ) : isDark ? (
        <Sun className="h-5 w-5" aria-hidden />
      ) : (
        <Moon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
