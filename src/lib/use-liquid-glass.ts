import { useEffect, type RefObject } from "react";

/**
 * The OS "liquid glass" pointer behaviour, applied app-wide from the shell:
 * - the wallpaper and the content plane parallax in opposite directions (depth)
 * - a specular highlight rolls across whichever glass surface (.os-card / .panel)
 *   the pointer is over
 *
 * Gated to fine pointers, so touch devices get no fake hover. Uses a single
 * rAF-throttled listener on the root.
 */
export function useLiquidGlass(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        root.style.setProperty("--par-x", `${(-dx * 20).toFixed(1)}px`);
        root.style.setProperty("--par-y", `${(-dy * 20).toFixed(1)}px`);
        root.style.setProperty("--par-x2", `${(dx * 6).toFixed(1)}px`);
        root.style.setProperty("--par-y2", `${(dy * 6).toFixed(1)}px`);
        const card = (e.target as HTMLElement)?.closest?.(".os-card, .panel") as HTMLElement | null;
        if (card) {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${e.clientX - r.left}px`);
          card.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
      });
    };
    root.addEventListener("pointermove", onMove);
    return () => {
      root.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [rootRef]);
}
