import { createClient } from "@/lib/supabase/server";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  addDays,
  fmtClockDuration,
  fmtDateShort,
  fmtTime,
  todayIso,
  PROVIDER_LABEL,
} from "@/lib/format";

export const metadata = { title: "Sleep — Health Agg" };

export default async function SleepPage() {
  const supabase = await createClient();
  const start = addDays(todayIso(), -29);

  const { data: sessions } = await supabase
    .from("sleep_sessions")
    .select("*")
    .gte("local_date", start)
    .order("local_date", { ascending: false })
    .order("duration_asleep_s", { ascending: false });

  const dates: string[] = [];
  for (let d = start; d <= todayIso(); d = addDays(d, 1)) dates.push(d);
  const primaryByDate = new Map<string, number>();
  for (const s of sessions ?? []) {
    if (s.is_nap || s.duration_asleep_s == null) continue;
    const cur = primaryByDate.get(s.local_date);
    if (cur == null || s.duration_asleep_s > cur) primaryByDate.set(s.local_date, s.duration_asleep_s);
  }
  const trend = dates.map((date) => ({ date, value: primaryByDate.get(date) ?? null }));

  return (
    <div>
      <p className="eyebrow" style={{ color: "var(--sleep)" }}>
        Sleep
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Last 30 nights</h1>

      <div className="mt-6 rounded-xl border border-hairline bg-card p-5">
        <p className="mb-3 text-sm text-muted">Time asleep per night</p>
        <TrendChart points={trend} color="var(--sleep)" kind="duration" />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Night</th>
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Source</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Asleep</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">In bed</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Deep</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">REM</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">HRV</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Score</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Window</th>
            </tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => (
              <tr key={s.id} className="border-b border-hairline last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  {fmtDateShort(s.local_date)}
                  {s.is_nap && <span className="ml-1.5 text-xs text-faint">nap</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-md px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--sleep-soft)", color: "var(--sleep)" }}>
                    {PROVIDER_LABEL[s.provider] ?? s.provider}
                  </span>
                </td>
                <td className="metric px-4 py-2.5 text-right">{fmtClockDuration(s.duration_asleep_s)}</td>
                <td className="metric px-4 py-2.5 text-right">{fmtClockDuration(s.time_in_bed_s)}</td>
                <td className="metric px-4 py-2.5 text-right">{fmtClockDuration(s.stage_deep_s)}</td>
                <td className="metric px-4 py-2.5 text-right">{fmtClockDuration(s.stage_rem_s)}</td>
                <td className="metric px-4 py-2.5 text-right">
                  {s.hrv_rmssd_ms != null ? `${Math.round(s.hrv_rmssd_ms)}` : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">{s.score != null ? Math.round(s.score) : "—"}</td>
                <td className="metric whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted">
                  {fmtTime(s.start_at)}–{fmtTime(s.end_at)}
                </td>
              </tr>
            ))}
            {!sessions?.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-faint">
                  No sleep data yet. Connect WHOOP or Eight Sleep to start syncing nights.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
