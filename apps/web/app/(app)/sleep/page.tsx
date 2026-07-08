import { createClient } from "@/lib/supabase/server";
import { CompareChart, type CompareSeries } from "@/components/charts/compare-chart";
import {
  addDays,
  fmtClockDuration,
  fmtDateShort,
  fmtTimeCompact,
  todayIso,
} from "@/lib/format";

export const metadata = { title: "Sleep — Health Agg" };

const SOURCES = [
  { key: "whoop", label: "WHOOP", color: "var(--series-whoop)" },
  { key: "eight_sleep", label: "Eight Sleep", color: "var(--series-eightsleep)" },
] as const;

type SourceKey = (typeof SOURCES)[number]["key"];

type Session = {
  id: string;
  provider: string;
  local_date: string;
  start_at: string;
  end_at: string;
  duration_asleep_s: number | null;
  time_in_bed_s: number | null;
  stage_deep_s: number | null;
  stage_rem_s: number | null;
  hrv_rmssd_ms: number | null;
  score: number | null;
  is_nap: boolean;
};

type Night = { date: string; bySource: Partial<Record<SourceKey, Session>> };

function fmtDelta(seconds: number): string {
  const mins = Math.round(Math.abs(seconds) / 60);
  const sign = seconds > 0 ? "+" : "−";
  if (mins >= 60) return `${sign}${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  return `${sign}${mins}m`;
}

/** Two stacked values, one per source, in fixed source order. */
function PairCell({
  night,
  render,
}: {
  night: Night;
  render: (s: Session) => string;
}) {
  return (
    <div className="space-y-1">
      {SOURCES.map(({ key, color }) => {
        const session = night.bySource[key];
        return (
          <div key={key} className="flex items-center justify-end gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color, opacity: session ? 1 : 0.25 }}
            />
            <span className={`metric ${session ? "" : "text-faint"}`}>
              {session ? render(session) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function SleepPage() {
  const supabase = await createClient();
  const start = addDays(todayIso(), -29);

  const { data } = await supabase
    .from("sleep_sessions")
    .select(
      "id, provider, local_date, start_at, end_at, duration_asleep_s, time_in_bed_s, stage_deep_s, stage_rem_s, hrv_rmssd_ms, score, is_nap",
    )
    .gte("local_date", start)
    .order("local_date", { ascending: false });

  const sessions = (data ?? []) as Session[];
  const naps = sessions.filter((s) => s.is_nap);

  // one row per night; per-source primary session = longest of that source's non-naps
  const nightMap = new Map<string, Night>();
  for (const s of sessions) {
    if (s.is_nap) continue;
    const key = s.provider as SourceKey;
    if (!SOURCES.some((src) => src.key === key)) continue;
    const night = nightMap.get(s.local_date) ?? { date: s.local_date, bySource: {} };
    const existing = night.bySource[key];
    if (!existing || (s.duration_asleep_s ?? 0) > (existing.duration_asleep_s ?? 0)) {
      night.bySource[key] = s;
    }
    nightMap.set(s.local_date, night);
  }
  const nights = [...nightMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  // chart series over the full 30-day domain
  const dates: string[] = [];
  for (let d = start; d <= todayIso(); d = addDays(d, 1)) dates.push(d);
  const seriesFor = (metric: (s: Session) => number | null): CompareSeries[] =>
    SOURCES.map(({ key, label, color }) => ({
      id: key,
      label,
      color,
      points: dates.map((date) => {
        const session = nightMap.get(date)?.bySource[key];
        return { date, value: session ? metric(session) : null };
      }),
    }));

  const bothCount = nights.filter((n) => n.bySource.whoop && n.bySource.eight_sleep).length;

  return (
    <div>
      <p className="eyebrow" style={{ color: "var(--sleep)" }}>
        Sleep
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Last 30 nights</h1>
      <p className="mt-1 text-sm text-muted">
        WHOOP and Eight Sleep, night by night — {bothCount} night
        {bothCount === 1 ? "" : "s"} measured by both.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-card p-5">
          <p className="mb-3 text-sm text-muted">Time asleep</p>
          <CompareChart series={seriesFor((s) => s.duration_asleep_s)} kind="duration" />
        </div>
        <div className="rounded-xl border border-hairline bg-card p-5">
          <p className="mb-3 text-sm text-muted">Sleep score</p>
          <CompareChart series={seriesFor((s) => s.score)} kind="int" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-faint">
                Night
                <span className="mt-1 flex flex-col gap-0.5 font-normal">
                  {SOURCES.map(({ key, label, color }) => (
                    <span key={key} className="flex items-center gap-1.5 text-[10px] text-faint">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </span>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Asleep</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Δ Asleep</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Score</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Deep</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">REM</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">HRV</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">In bed</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Window</th>
            </tr>
          </thead>
          <tbody>
            {nights.map((night) => {
              const w = night.bySource.whoop;
              const e = night.bySource.eight_sleep;
              const delta =
                w?.duration_asleep_s != null && e?.duration_asleep_s != null
                  ? e.duration_asleep_s - w.duration_asleep_s
                  : null;
              return (
                <tr key={night.date} className="border-b border-hairline align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    {fmtDateShort(night.date)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell night={night} render={(s) => fmtClockDuration(s.duration_asleep_s)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {delta != null ? (
                      <span
                        className="metric rounded-md px-1.5 py-0.5 text-xs"
                        style={{
                          backgroundColor: "var(--sleep-soft)",
                          color: "var(--sleep)",
                        }}
                        title="Eight Sleep minus WHOOP"
                      >
                        {fmtDelta(delta)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell night={night} render={(s) => (s.score != null ? String(Math.round(s.score)) : "—")} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell night={night} render={(s) => fmtClockDuration(s.stage_deep_s)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell night={night} render={(s) => fmtClockDuration(s.stage_rem_s)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell
                      night={night}
                      render={(s) => (s.hrv_rmssd_ms != null ? String(Math.round(s.hrv_rmssd_ms)) : "—")}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell night={night} render={(s) => fmtClockDuration(s.time_in_bed_s)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PairCell
                      night={night}
                      render={(s) => `${fmtTimeCompact(s.start_at)}–${fmtTimeCompact(s.end_at)}`}
                    />
                  </td>
                </tr>
              );
            })}
            {!nights.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-faint">
                  No sleep data yet. Connect WHOOP or Eight Sleep to start syncing nights.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {naps.length > 0 && (
        <div className="mt-4 rounded-xl border border-hairline bg-card px-4 py-3">
          <p className="text-xs font-medium text-faint">Naps</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {naps.map((nap) => (
              <li key={nap.id} className="flex items-baseline justify-between">
                <span>{fmtDateShort(nap.local_date)}</span>
                <span className="metric text-xs text-muted">
                  {fmtClockDuration(nap.duration_asleep_s)} · {fmtTimeCompact(nap.start_at)}–
                  {fmtTimeCompact(nap.end_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
