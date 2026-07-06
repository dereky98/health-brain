"use client";

import { useId, useRef, useState } from "react";

export type TrendPoint = {
  date: string; // YYYY-MM-DD
  value: number | null;
};

type Hover = { index: number; px: number; py: number } | null;

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Single-series line chart with crosshair + tooltip. One y-axis, recessive
 * grid, direct value in the tooltip. Height fixed; width fills container.
 */
const FORMATTERS = {
  int: (v: number) => String(Math.round(v)),
  float1: (v: number) => v.toFixed(1),
  duration: (v: number) => {
    const totalMin = Math.round(v / 60);
    return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}`;
  },
} as const;

export function TrendChart({
  points,
  color,
  unit = "",
  kind = "int",
  height = 180,
}: {
  points: TrendPoint[];
  color: string;
  unit?: string;
  kind?: keyof typeof FORMATTERS;
  height?: number;
}) {
  const format = FORMATTERS[kind];
  const [hover, setHover] = useState<Hover>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();

  const width = 640; // viewBox units; scales to container
  const pad = { top: 12, right: 8, bottom: 22, left: 40 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const present = points.map((p) => p.value).filter((v): v is number => v != null);
  if (present.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-hairline text-xs text-faint"
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const min = Math.min(...present);
  const max = Math.max(...present);
  const spread = max - min || 1;
  const lo = min - spread * 0.12;
  const hi = max + spread * 0.12;

  const x = (i: number) => pad.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * ih;

  // gap-aware segments
  const segments: string[] = [];
  let seg: string[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (seg.length > 1) segments.push(seg.join(" "));
      seg = [];
      return;
    }
    seg.push(`${seg.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  });
  if (seg.length > 1) segments.push(seg.join(" "));

  const gridValues = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75];
  const tickEvery = Math.max(1, Math.floor(points.length / 6));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let idx = Math.round(((relX - pad.left) / iw) * (points.length - 1));
    idx = Math.max(0, Math.min(points.length - 1, idx));
    // snap to nearest non-null
    let best = -1;
    for (let d = 0; d < points.length; d++) {
      for (const cand of [idx - d, idx + d]) {
        if (cand >= 0 && cand < points.length && points[cand].value != null) {
          best = cand;
          break;
        }
      }
      if (best !== -1) break;
    }
    if (best === -1) return setHover(null);
    setHover({ index: best, px: x(best), py: y(points[best].value!) });
  }

  const h = hover && points[hover.index];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none"
        style={{ height: "auto" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={pad.left} y={pad.top} width={iw} height={ih} />
          </clipPath>
        </defs>

        {gridValues.map((gv) => (
          <g key={gv}>
            <line x1={pad.left} x2={width - pad.right} y1={y(gv)} y2={y(gv)} stroke="var(--hairline)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(gv) + 3} textAnchor="end" fontSize={10} fill="var(--faint)" className="metric">
              {format(gv)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % tickEvery === 0 ? (
            <text key={p.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--faint)">
              {fmtDay(p.date)}
            </text>
          ) : null,
        )}

        <g clipPath={`url(#${clipId})`}>
          {segments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>

        {hover && (
          <g>
            <line x1={hover.px} x2={hover.px} y1={pad.top} y2={pad.top + ih} stroke="var(--hairline-strong)" strokeWidth={1} />
            <circle cx={hover.px} cy={hover.py} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {h && h.value != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-hairline bg-card px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(hover!.px / width) * 100}%`, top: 0 }}
        >
          <span className="text-faint">{fmtDay(h.date)}</span>{" "}
          <span className="metric font-medium">
            {format(h.value)}
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}
