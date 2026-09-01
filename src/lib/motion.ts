import type { Transition, Variants } from "motion/react";

/**
 * Shared motion language. One signature spring + a small set of variants so
 * every animation across the app feels like the same hand. Framer Motion already
 * honors the OS "reduce motion" setting via <MotionConfig reducedMotion="user">
 * (wired in the app layout), so these presets stay simple.
 */

/** The signature spring — soft, quick, a touch of overshoot. */
export const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.9,
};

/** A calmer spring for larger surfaces (sheets, panels). */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 240,
  damping: 30,
};

export const easeOut: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

/** Fade + rise — the default entrance for cards and sections. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
};

/** Pop-in for emphasis (score, celebrations). */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: spring },
};

/** Parent that staggers its children's entrance. Pair with `fadeUp` items. */
export const stagger = (gap = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

/** Page transition (used by the app-layout AnimatePresence wrapper). */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};
