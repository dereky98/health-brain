"use client";

import { useId, useRef, useState } from "react";

export type ComparePoint = { date: string; value: number | null };

export type CompareSeries = {
  id: string;
  label: string;
  color: string; // CSS color (var(--…) ok)
  points: ComparePoint[]; // aligned to the same date domain across series
};

const FORMATTERS = {
  int: (v: number) => String(Math.round(v)),
  float1: (v: number) => v.toFixed(1),
  duration: (v: number) => {
    const totalMin = Math.round(v / 60);
    return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}`;
  },
} as const;

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Multi-series line chart for comparing sources over the same date range.
 * One y-axis; legend above; crosshair tooltip shows every series' value for
 * the hovered night.
 */
export function CompareChart({
  series,
  unit = "",
  kind = "int",
  height = 200,
}: {
  series: CompareSeries[];
  unit?: string;
  kind?: keyof typeof FORMATTERS;
  height?: number;
}) {
  const format = FORMATTERS[kind];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();

  const width = 640;
  const pad = { top: 12, right: 8, bottom: 22, left: 40 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const allValues = series.flatMap((s) => s.points.map((p) => p.value)).filter(
    (v): v is number => v != null,
  );

  if (dates.length < 2 || allValues.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-hairline text-xs text-faint"
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const spread = max - min || 1;
  const lo = min - spread * 0.12;
  const hi = max + spread * 0.12;

  const x = (i: number) => pad.left + (i / (dates.length - 1)) * iw;
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * ih;

  const pathsFor = (points: ComparePoint[]): string[] => {
    const out: string[] = [];
    let seg: string[] = [];
    points.forEach((p, i) => {
      if (p.value == null) {
        if (seg.length > 1) out.push(seg.join(" "));
        seg = [];
        return;
      }
      seg.push(`${seg.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    });
    if (seg.length > 1) out.push(seg.join(" "));
    return out;
  };

  const gridValues = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75];
  const tickEvery = Math.max(1, Math.floor(dates.length / 6));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let idx = Math.round(((relX - pad.left) / iw) * (dates.length - 1));
    idx = Math.max(0, Math.min(dates.length - 1, idx));
    // snap to nearest date where at least one series has a value
    let best = -1;
    for (let d = 0; d < dates.length; d++) {
      for (const cand of [idx - d, idx + d]) {
        if (cand >= 0 && cand < dates.length && series.some((s) => s.points[cand]?.value != null)) {
          best = cand;
          break;
        }
      }
      if (best !== -1) break;
    }
    setHoverIdx(best === -1 ? null : best);
  }

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none"
        style={{ height: "auto" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIdx(null)}
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

        {dates.map((d, i) =>
          i % tickEvery === 0 ? (
            <text key={d} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--faint)">
              {fmtDay(d)}
            </text>
          ) : null,
        )}

        <g clipPath={`url(#${clipId})`}>
          {series.map((s) =>
            pathsFor(s.points).map((d, i) => (
              <path
                key={`${s.id}-${i}`}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )),
          )}
        </g>

        {hoverIdx != null && (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={pad.top}
              y2={pad.top + ih}
              stroke="var(--hairline-strong)"
              strokeWidth={1}
            />
            {series.map((s) => {
              const v = s.points[hoverIdx]?.value;
              return v != null ? (
                <circle key={s.id} cx={x(hoverIdx)} cy={y(v)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ) : null;
            })}
          </g>
        )}
      </svg>

      {hoverIdx != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-hairline bg-card px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(x(hoverIdx) / width) * 100}%`, top: 18 }}
        >
          <div className="text-faint">{fmtDay(dates[hoverIdx])}</div>
          {series.map((s) => {
            const v = s.points[hoverIdx]?.value;
            return (
              <div key={s.id} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="metric font-medium">
                  {v != null ? `${format(v)}${unit}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
