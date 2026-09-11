/**
 * 12-month revenue bars. Single brand hue (magnitude, not identity), thin
 * rounded marks, selective direct labels — and semantic tokens so it reads
 * correctly in both themes.
 *
 * Three things were wrong and are fixed here.
 *
 * 1. The axis labels were SVG <text> inside a 640-unit viewBox scaled with
 *    `w-full`. At a 360px viewport that is a 0.51 scale factor, so
 *    `fontSize="10"` rendered at about 5px — unreadable, and invisible to the
 *    12px floor the rest of the system enforces, because a scaled SVG unit is
 *    not a CSS pixel. The labels are now real HTML beneath the plot, so they use
 *    the type scale and never scale with the drawing.
 *
 * 2. `role="img"` on the <svg> prunes everything inside it from the
 *    accessibility tree — including all 12 <title> elements, which were the only
 *    way the actual numbers were exposed. So the one chart in the product
 *    announced a single summary label and then hid every data point. There is
 *    now a visually-hidden table carrying the real figures.
 *
 * 3. RTL was implemented by index arithmetic inside the bar loop
 *    (`points.length - 1 - i`), which silently assumes the document is RTL and
 *    puts the newest month on the left. The order is now computed once, up
 *    front, and the HTML labels use the same array — so the bars and their
 *    labels cannot drift out of step.
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

const ils = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export function RevenueChart({ points }: { points: MonthPoint[] }) {
  const width = 640;
  const height = 176;
  const padX = 8;
  const padTop = 18;

  const max = Math.max(...points.map((p) => p.value), 1);
  const barGap = 6;
  const barWidth = (width - padX * 2 - barGap * (points.length - 1)) / points.length;

  // Newest month first. In an RTL document that renders on the right, which is
  // what the old index arithmetic was doing implicitly; stating it once here
  // keeps the bars and the labels below them in the same order by construction.
  const ordered = [...points].reverse();
  const peakValue = Math.max(...points.map((p) => p.value));

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        // Presentational: the numbers live in the table below, which is what a
        // screen reader should read instead of a pile of unlabelled rects.
        aria-hidden
        focusable="false"
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={height - 1}
          y2={height - 1}
          stroke="var(--color-edge)"
          strokeWidth="1"
        />
        {ordered.map((p, i) => {
          const h = Math.max(p.value > 0 ? 3 : 0, ((height - padTop - 2) * p.value) / max);
          const x = padX + i * (barWidth + barGap);
          const y = height - 1 - h;
          const isPeak = p.value > 0 && p.value === peakValue;
          return (
            <g key={`${p.year}-${p.month}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx="4"
                fill={isPeak ? "var(--color-brand-600)" : "var(--color-brand-400)"}
                opacity={isPeak ? 1 : 0.75}
              />
              {/* The peak value is the one direct label worth drawing. It sits
                  in SVG units, so it is sized generously enough to survive the
                  scale-down on a phone. */}
              {isPeak && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="17"
                  fontWeight="600"
                  fill="var(--color-ink)"
                >
                  {ils(p.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Month labels as HTML, on the type scale, in the same order as the bars. */}
      <ul
        aria-hidden
        className="mt-1 flex gap-1.5 px-2"
        style={{ paddingInline: `${(padX / width) * 100}%` }}
      >
        {ordered.map((p) => (
          <li
            key={`${p.year}-${p.month}`}
            className="min-w-0 flex-1 truncate text-center text-xs text-ink-muted"
          >
            {MONTH_LABELS[p.month]}
          </li>
        ))}
      </ul>

      {/* The data, for anyone not looking at the picture. */}
      <table className="sr-only">
        <caption>מחזור חודשי, 12 החודשים האחרונים</caption>
        <thead>
          <tr>
            <th scope="col">חודש</th>
            <th scope="col">מחזור</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={`${p.year}-${p.month}`}>
              <th scope="row">{`${MONTH_LABELS[p.month]} ${p.year}`}</th>
              <td>{ils(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
