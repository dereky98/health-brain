// The day band: a 24-hour strip from 6pm yesterday to 6pm today. Sleep
// sessions render as indigo bands, workouts as orange ticks — one glance shows
// the architecture of your day: when you slept, when you trained.

type Interval = { start: string; end: string | null; kind: "sleep" | "nap" | "workout" };

const BAND_HOURS = 24;

function hourMarks(): number[] {
  // 6pm, 9pm, 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm
  return [0, 3, 6, 9, 12, 15, 18, 21, 24];
}

function labelFor(offset: number): string {
  const hour = (18 + offset) % 24;
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

export function DayBand({ date, intervals }: { date: string; intervals: Interval[] }) {
  // Window: (date - 1) 18:00 local → date 18:00 local. Dates in the data are
  // UTC instants; we render relative to the window using UTC math on the
  // already-local-corrected local_date boundary. Good enough for a glanceable band.
  const windowEnd = new Date(`${date}T18:00:00`);
  const windowStart = new Date(windowEnd.getTime() - BAND_HOURS * 3600_000);

  const width = 640;
  const height = 46;
  const trackY = 14;
  const trackH = 14;

  const xFor = (iso: string) => {
    const t = new Date(iso).getTime();
    const frac = (t - windowStart.getTime()) / (BAND_HOURS * 3600_000);
    return Math.max(0, Math.min(1, frac)) * width;
  };

  const visible = intervals.filter((iv) => {
    const start = new Date(iv.start).getTime();
    const end = new Date(iv.end ?? iv.start).getTime();
    return end > windowStart.getTime() && start < windowEnd.getTime();
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Timeline of sleep and workouts for ${date}`}>
      {/* track */}
      <rect x={0} y={trackY} width={width} height={trackH} rx={7} fill="var(--hairline)" opacity={0.55} />

      {/* hour ticks */}
      {hourMarks().map((h) => {
        const x = (h / BAND_HOURS) * width;
        return (
          <g key={h}>
            <line x1={x} x2={x} y1={trackY - 3} y2={trackY + trackH + 3} stroke="var(--hairline-strong)" strokeWidth={h % 6 === 0 ? 1 : 0.5} opacity={h === 0 || h === 24 ? 0 : 0.8} />
            {h % 6 === 0 && h !== 0 && h !== 24 && (
              <text x={x} y={height - 2} textAnchor="middle" fontSize={9.5} fill="var(--faint)">
                {labelFor(h)}
              </text>
            )}
          </g>
        );
      })}

      {/* sleep bands + workout ticks */}
      {visible.map((iv, i) => {
        const x1 = xFor(iv.start);
        const x2 = iv.end ? xFor(iv.end) : x1 + 4;
        const w = Math.max(x2 - x1, 4);
        if (iv.kind === "workout") {
          return (
            <rect key={i} x={x1} y={trackY - 4} width={w} height={trackH + 8} rx={4} fill="var(--activity)" stroke="var(--background)" strokeWidth={2} />
          );
        }
        return (
          <rect
            key={i}
            x={x1}
            y={trackY}
            width={w}
            height={trackH}
            rx={7}
            fill="var(--sleep)"
            opacity={iv.kind === "nap" ? 0.55 : 1}
            stroke="var(--background)"
            strokeWidth={2}
          />
        );
      })}

      <text x={0} y={height - 2} fontSize={9.5} fill="var(--faint)">
        6pm
      </text>
      <text x={width} y={height - 2} textAnchor="end" fontSize={9.5} fill="var(--faint)">
        6pm
      </text>
    </svg>
  );
}
