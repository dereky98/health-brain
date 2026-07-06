import { createClient } from "@/lib/supabase/server";
import { TrendChart } from "@/components/charts/trend-chart";
import { addDays, fmtDateShort, todayIso, PROVIDER_LABEL } from "@/lib/format";

export const metadata = { title: "Recovery — Health Agg" };

export default async function RecoveryPage() {
  const supabase = await createClient();
  const start = addDays(todayIso(), -29);

  const { data: rows } = await supabase
    .from("recovery_metrics")
    .select("*")
    .gte("local_date", start)
    .order("local_date", { ascending: false });

  const dates: string[] = [];
  for (let d = start; d <= todayIso(); d = addDays(d, 1)) dates.push(d);
  const byDate = new Map((rows ?? []).map((r) => [r.local_date, r]));

  const recoveryTrend = dates.map((date) => ({
    date,
    value: byDate.get(date)?.recovery_score ?? null,
  }));
  const hrvTrend = dates.map((date) => ({ date, value: byDate.get(date)?.hrv_rmssd_ms ?? null }));

  return (
    <div>
      <p className="eyebrow" style={{ color: "var(--recovery)" }}>
        Recovery
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Last 30 days</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-card p-5">
          <p className="mb-3 text-sm text-muted">Recovery score</p>
          <TrendChart points={recoveryTrend} color="var(--recovery)" unit="%" />
        </div>
        <div className="rounded-xl border border-hairline bg-card p-5">
          <p className="mb-3 text-sm text-muted">HRV (RMSSD)</p>
          <TrendChart points={hrvTrend} color="var(--recovery)" unit=" ms" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Day</th>
              <th className="px-4 py-2.5 text-xs font-medium text-faint">Source</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Recovery</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">HRV</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Resting HR</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">SpO₂</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Skin temp</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">Day strain</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">{fmtDateShort(r.local_date)}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-md px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--recovery-soft)", color: "var(--recovery)" }}>
                    {PROVIDER_LABEL[r.provider] ?? r.provider}
                  </span>
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.recovery_score != null ? `${Math.round(r.recovery_score)}%` : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.hrv_rmssd_ms != null ? `${Math.round(r.hrv_rmssd_ms)} ms` : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.resting_hr_bpm != null ? Math.round(r.resting_hr_bpm) : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.spo2_pct != null ? `${r.spo2_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.skin_temp_c != null ? `${r.skin_temp_c.toFixed(1)}°` : "—"}
                </td>
                <td className="metric px-4 py-2.5 text-right">
                  {r.day_strain != null ? r.day_strain.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-faint">
                  No recovery data yet. Connect WHOOP to start syncing daily recovery.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
