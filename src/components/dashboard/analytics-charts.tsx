"use client";

// Analytics chart components — built with pure SVG and CSS.
// No recharts, chart.js, or any other chart library dependency.
// This keeps the bundle lean and gives us full control over the glass aesthetic.

import { cn } from "@/lib/utils";

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface AnalyticsChartsProps {
  type: "donut" | "bar" | "line";
  data: DataPoint[];
  className?: string;
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: DataPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[rgb(var(--text-muted))]">
        No data yet
      </div>
    );
  }

  const SIZE = 160;
  const STROKE = 28;
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const CENTER = SIZE / 2;

  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * CIRCUMFERENCE;
    const gap = CIRCUMFERENCE - dash;
    const seg = { ...d, dash, gap, offset, pct };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={CENTER} cy={CENTER} r={R}
            fill="none"
            stroke="rgb(var(--text-muted) / 0.15)"
            strokeWidth={STROKE}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={CENTER} cy={CENTER} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[rgb(var(--text-primary))]">{total}</span>
          <span className="text-[10px] text-[rgb(var(--text-muted))]">total</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="space-y-2.5 flex-1">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: seg.color }}
              />
              <span className="text-xs text-[rgb(var(--text-secondary))] truncate">
                {seg.label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-medium text-[rgb(var(--text-primary))]">
                {seg.value}
              </span>
              <span className="text-[10px] text-[rgb(var(--text-muted))] ml-1">
                ({Math.round(seg.pct * 100)}%)
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: DataPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[rgb(var(--text-secondary))]">{d.label}</span>
            <span className="font-medium text-[rgb(var(--text-primary))]">{d.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[rgb(var(--text-muted)/0.15)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color,
              }}
            />
          </div>
        </div>
      ))}
      {data.every((d) => d.value === 0) && (
        <p className="text-sm text-[rgb(var(--text-muted))] text-center py-4">No data yet</p>
      )}
    </div>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[rgb(var(--text-muted))]">
        No data yet
      </div>
    );
  }

  const W = 600;
  const H = 140;
  const PAD = { top: 10, right: 10, bottom: 28, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - ((d.value - min) / (max - min)) * chartH,
    ...d,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Area fill path
  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${PAD.top + chartH}` +
    ` L ${points[0].x} ${PAD.top + chartH} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [0, Math.round(max / 2), max];

  // X-axis: show first, middle, last label
  const xLabels = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ].filter(Boolean);

  const color = data[0]?.color ?? "rgb(99 102 241)";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 280 }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = PAD.top + chartH - ((tick - min) / (max - min)) * chartH;
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="rgb(var(--text-muted) / 0.15)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 6} y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="rgb(var(--text-muted))"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="rgb(var(--text-muted))"
          >
            {/* Show MM-DD */}
            {String(p.label).slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function AnalyticsCharts({ type, data, className }: AnalyticsChartsProps) {
  return (
    <div className={cn("w-full", className)}>
      {type === "donut" && <DonutChart data={data} />}
      {type === "bar" && <BarChart data={data} />}
      {type === "line" && <LineChart data={data} />}
    </div>
  );
}
