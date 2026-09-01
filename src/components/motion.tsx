"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  type Variants,
} from "motion/react";
import { fadeUp, spring, stagger } from "@/lib/motion";

/** App-wide motion provider — honors the OS reduce-motion setting globally. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fade + rise a block into view on mount (or when scrolled into view). */
export function FadeIn({
  children,
  className,
  delay = 0,
  whenInView = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  whenInView?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const animate = whenInView ? (inView ? "show" : "hidden") : "show";
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate={animate}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers direct children (each should be a <Stagger.Item>). */
export function Stagger({
  children,
  className,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={stagger(gap)}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

const item: Variants = fadeUp;
Stagger.Item = function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
};

/** A number that springs to its value — for scores, counts, percentages. */
export function AnimatedNumber({
  value,
  className,
  format = (n) => Math.round(n).toLocaleString("he-IL"),
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  useEffect(() => sp.on("change", (v) => setDisplay(format(v))), [sp, format]);

  return <span className={className}>{display}</span>;
}
