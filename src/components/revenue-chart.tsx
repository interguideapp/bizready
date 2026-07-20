/**
 * 12-month revenue bars. Single brand hue (magnitude, not identity), thin
 * rounded marks, selective direct labels — and semantic tokens so it reads
 * correctly in both themes.
 */
const MONTH_LABELS = [
  "ינו",
  "פבר",
  "מרץ",
  "אפר",
  "מאי",
  "יונ",
  "יול",
  "אוג",
  "ספט",
  "אוק",
  "נוב",
  "דצמ",
];

export interface MonthPoint {
  year: number;
  month: number; // 0-11
  value: number;
}

export function RevenueChart({ points }: { points: MonthPoint[] }) {
  const width = 640;
  const height = 200;
  const padX = 8;
  const padBottom = 22;
  const padTop = 18;

  const max = Math.max(...points.map((p) => p.value), 1);
  const barGap = 6;
  const barWidth = (width - padX * 2 - barGap * (points.length - 1)) / points.length;
  const maxIdx = points.reduce(
    (best, p, i) => (p.value > points[best].value ? i : best),
    0
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="מחזור חודשי, 12 חודשים אחרונים"
    >
      {/* baseline */}
      <line
        x1={padX}
        x2={width - padX}
        y1={height - padBottom}
        y2={height - padBottom}
        stroke="var(--color-edge)"
        strokeWidth="1"
      />
      {points.map((p, i) => {
        const h = Math.max(
          p.value > 0 ? 3 : 0,
          ((height - padBottom - padTop) * p.value) / max
        );
        // RTL: latest month on the left
        const x = padX + (points.length - 1 - i) * (barWidth + barGap);
        const y = height - padBottom - h;
        const isMax = i === maxIdx && p.value > 0;
        return (
          <g key={`${p.year}-${p.month}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx="4"
              fill={isMax ? "var(--color-brand-600)" : "var(--color-brand-400)"}
              opacity={isMax ? 1 : 0.75}
            >
              <title>{`${MONTH_LABELS[p.month]} ${p.year}: ₪${Math.round(p.value).toLocaleString()}`}</title>
            </rect>
            {/* selective direct label: only the peak month */}
            {isMax && (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="var(--color-ink)"
              >
                ₪{Math.round(p.value).toLocaleString()}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink-muted)"
            >
              {MONTH_LABELS[p.month]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
