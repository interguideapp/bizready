"use client";

import { useEffect, useState } from "react";

/** Animated readiness score ring (0-100). */
export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
  label = "ציון מוכנות",
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);

  return (
    <div
      className="relative animate-score-pop"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-ink">{score}</span>
        <span className="text-xs font-medium text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

/** Small per-category progress ring. */
export function MiniRing({
  score,
  size = 44,
  strokeWidth = 5,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-surface-3)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-brand-600)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - score / 100)}
      />
    </svg>
  );
}
