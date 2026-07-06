type Point = { x: number; y: number };

function path(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/**
 * Tiny single-series trend line. Nulls create gaps. Purely presentational —
 * the parent supplies the accessible summary.
 */
export function Sparkline({
  values,
  color,
  width = 120,
  height = 32,
}: {
  values: Array<number | null>;
  color: string;
  width?: number;
  height?: number;
}) {
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) {
    return <div style={{ width, height }} aria-hidden />;
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const pad = 3;

  const segments: Point[][] = [];
  let current: Point[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) segments.push(current);
      current = [];
      return;
    }
    current.push({
      x: pad + (i / (values.length - 1)) * (width - pad * 2),
      y: pad + (1 - (v - min) / span) * (height - pad * 2),
    });
  });
  if (current.length > 1) segments.push(current);

  const last = [...values].reverse().find((v) => v != null);
  const lastIdx = values.length - 1 - [...values].reverse().findIndex((v) => v != null);

  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      {segments.map((seg, i) => (
        <path key={i} d={path(seg)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {last != null && (
        <circle
          cx={pad + (lastIdx / (values.length - 1)) * (width - pad * 2)}
          cy={pad + (1 - (last - min) / span) * (height - pad * 2)}
          r={3}
          fill={color}
          stroke="var(--card)"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
