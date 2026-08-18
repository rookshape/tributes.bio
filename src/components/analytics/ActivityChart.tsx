import { useMemo, useRef, useState } from "react";
import type { DailyAnalytics } from "../../lib/types";

/**
 * Two-series trend over time.
 *
 * A line rather than the previous grouped bars: bars gave a single-day range one
 * flex-1 column that filled half the panel, and they degrade badly past ~30 days.
 * A line reads at any point count, and a one-point range draws as a lone dot.
 *
 * Colors are the brand accent plus orange — validated as a categorical pair
 * (CVD ΔE 28.0, normal-vision 35.4, both well clear of the floors).
 */
export const SERIES = [
  { key: "profileViews", label: "Profile views", color: "#0091ff" },
  { key: "linkClicks", label: "Link clicks", color: "#eb6834" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

/** Round a maximum up to a clean axis value (1, 2, 5 × 10ⁿ). */
function niceMaximum(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityChart({ daily }: { daily: DailyAnalytics[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maximum = useMemo(
    () =>
      niceMaximum(
        Math.max(1, ...daily.map((day) => Math.max(day.profileViews, day.linkClicks))),
      ),
    [daily],
  );

  const pointX = (index: number) =>
    daily.length === 1
      ? PADDING.left + PLOT_WIDTH / 2
      : PADDING.left + (index / (daily.length - 1)) * PLOT_WIDTH;

  const pointY = (value: number) =>
    PADDING.top + PLOT_HEIGHT - (value / maximum) * PLOT_HEIGHT;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: Math.round(maximum * fraction),
    y: PADDING.top + PLOT_HEIGHT - fraction * PLOT_HEIGHT,
  }));

  const trackPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || daily.length === 0) return;

    const bounds = svg.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const plotRatio = (ratio * WIDTH - PADDING.left) / PLOT_WIDTH;
    const index = Math.round(plotRatio * Math.max(1, daily.length - 1));
    setHoverIndex(Math.min(daily.length - 1, Math.max(0, index)));
  };

  const active = hoverIndex === null ? null : daily[hoverIndex];

  return (
    // Below ~520px the chart scrolls rather than scaling down — a uniform SVG
    // shrink would take the axis labels to about 5px.
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="relative min-w-[520px]">
      <svg
        className="w-full touch-none"
        onPointerDown={trackPointer}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={trackPointer}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title>Profile views and link clicks per day</title>

        {/* Hairline grid, one step off the surface. */}
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              stroke="rgb(var(--line))"
              strokeWidth="1"
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="fill-content-subtle text-[11px] [font-variant-numeric:tabular-nums]"
              dominantBaseline="middle"
              textAnchor="end"
              x={PADDING.left - 10}
              y={tick.y}
            >
              {tick.value.toLocaleString()}
            </text>
          </g>
        ))}

        {active && hoverIndex !== null ? (
          <line
            stroke="rgb(var(--line-strong))"
            strokeWidth="1"
            x1={pointX(hoverIndex)}
            x2={pointX(hoverIndex)}
            y1={PADDING.top}
            y2={PADDING.top + PLOT_HEIGHT}
          />
        ) : null}

        {SERIES.map((series) => {
          const points = daily.map(
            (day, index) => `${pointX(index)},${pointY(day[series.key as SeriesKey])}`,
          );

          return (
            <g key={series.key}>
              {daily.length > 1 ? (
                <polyline
                  fill="none"
                  points={points.join(" ")}
                  stroke={series.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              ) : null}
              {/* End marker, with a 2px surface ring so crossings stay legible. */}
              {daily.length ? (
                <circle
                  cx={pointX(daily.length - 1)}
                  cy={pointY(daily[daily.length - 1][series.key as SeriesKey])}
                  fill={series.color}
                  r="4"
                  stroke="rgb(var(--surface))"
                  strokeWidth="2"
                />
              ) : null}
              {hoverIndex !== null ? (
                <circle
                  cx={pointX(hoverIndex)}
                  cy={pointY(daily[hoverIndex][series.key as SeriesKey])}
                  fill={series.color}
                  r="4"
                  stroke="rgb(var(--surface))"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}

        <text
          className="fill-content-subtle text-[11px]"
          x={PADDING.left}
          y={HEIGHT - 8}
        >
          {formatDay(daily[0]?.date ?? "")}
        </text>
        {daily.length > 1 ? (
          <text
            className="fill-content-subtle text-[11px]"
            textAnchor="end"
            x={WIDTH - PADDING.right}
            y={HEIGHT - 8}
          >
            {formatDay(daily[daily.length - 1].date)}
          </text>
        ) : null}
      </svg>

      {active && hoverIndex !== null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 shadow-md"
          style={{ left: `${(pointX(hoverIndex) / WIDTH) * 100}%` }}
        >
          <p className="text-caption font-medium text-content-muted">
            {formatDay(active.date)}
          </p>
          {SERIES.map((series) => (
            <p
              className="mt-1 flex items-center gap-2 text-caption text-content"
              key={series.key}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
              <span className="ml-auto font-semibold [font-variant-numeric:tabular-nums]">
                {active[series.key as SeriesKey].toLocaleString()}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      </div>
    </div>
  );
}
