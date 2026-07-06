import { createClient } from "@/lib/supabase/server";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  addDays,
  fmtDateShort,
  fmtDuration,
  fmtKm,
  sportLabel,
  todayIso,
  PROVIDER_LABEL,
} from "@/lib/format";

export const metadata = { title: "Activity — Health Agg" };

const PROVIDER_STYLE: Record<string, { bg: string; fg: string }> = {
  strava: { bg: "var(--activity-soft)", fg: "var(--activity)" },
  whoop: { bg: "var(--sleep-soft)", fg: "var(--sleep)" },
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const start = addDays(todayIso(), -29);

  const { data: workouts } = await supabase
    .from("workouts")
    .select("*")
    .gte("local_date", start)
    .order("start_at", { ascending: false });

  const dates: string[] = [];
  for (let d = start; d <= todayIso(); d = addDays(d, 1)) dates.push(d);
  const minutesByDate = new Map<string, number>();
  for (const w of workouts ?? []) {
    minutesByDate.set(w.local_date, (minutesByDate.get(w.local_date) ?? 0) + (w.duration_s ?? 0) / 60);
  }
  const trend = dates.map((date) => ({
    date,
    value: minutesByDate.has(date) ? Math.round(minutesByDate.get(date)!) : 0,
  }));

  return (
    <div>
      <p className="eyebrow" style={{ color: "var(--activity)" }}>
        Activity
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Last 30 days</h1>

      <div className="mt-6 rounded-xl border border-hairline bg-card p-5">
        <p className="mb-3 text-sm text-muted">Training minutes per day</p>
        <TrendChart points={trend} color="var(--activity)" unit=" min" />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Date</th>
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Workout</th>
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Source</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Duration</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Distance</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Avg HR</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Calories</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Strain</th>
            </tr>
          </thead>
          <tbody>
            {(workouts ?? []).map((w) => {
              const style = PROVIDER_STYLE[w.provider] ?? PROVIDER_STYLE.strava;
              return (
                <tr key={w.id} className="border-b border-hairline last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtDateShort(w.local_date)}</td>
                  <td className="px-4 py-2.5">{sportLabel(w.sport)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md px-1.5 py-0.5 text-xs" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {PROVIDER_LABEL[w.provider] ?? w.provider}
                    </span>
                  </td>
                  <td className="metric px-4 py-2.5 text-right">{fmtDuration(w.duration_s)}</td>
                  <td className="metric px-4 py-2.5 text-right">{w.distance_m ? fmtKm(w.distance_m) : "—"}</td>
                  <td className="metric px-4 py-2.5 text-right">
                    {w.avg_hr_bpm != null ? Math.round(w.avg_hr_bpm) : "—"}
                  </td>
                  <td className="metric px-4 py-2.5 text-right">
                    {w.calories_kcal != null ? Math.round(w.calories_kcal) : "—"}
                  </td>
                  <td className="metric px-4 py-2.5 text-right">
                    {w.strain != null ? w.strain.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
            {!workouts?.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-faint">
                  No workouts yet. Connect Strava or WHOOP to start syncing training.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
