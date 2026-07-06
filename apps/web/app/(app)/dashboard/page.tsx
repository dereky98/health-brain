import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DayBand } from "@/components/day-band";
import { Sparkline } from "@/components/charts/sparkline";
import {
  addDays,
  fmtClockDuration,
  fmtDateLong,
  fmtDuration,
  fmtKm,
  fmtTimeCompact,
  sportLabel,
  todayIso,
} from "@/lib/format";

export const metadata = { title: "Dashboard — Health Agg" };

type Search = Promise<{ date?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const today = todayIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;

  const supabase = await createClient();
  const trendStart = addDays(date, -13);

  const [{ data: days }, { data: daySleep }, { data: dayWorkouts }, { count: connCount }] =
    await Promise.all([
      supabase
        .from("daily_summaries")
        .select("*")
        .gte("local_date", trendStart)
        .lte("local_date", date)
        .order("local_date"),
      supabase.from("sleep_sessions").select("*").eq("local_date", date),
      supabase.from("workouts").select("*").eq("local_date", date).order("start_at"),
      supabase
        .from("provider_connections")
        .select("*", { count: "exact", head: true })
        .neq("status", "disconnected"),
    ]);

  const summary = days?.find((d) => d.local_date === date) ?? null;

  if (!connCount && !days?.length) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="eyebrow">No data yet</p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          Connect a device to see your first morning report
        </h1>
        <p className="mt-3 text-sm text-muted">
          Health Agg pulls sleep, recovery, and training from WHOOP, Strava, and Eight Sleep into
          one place.
        </p>
        <Link
          href="/integrations"
          className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Open integrations
        </Link>
      </div>
    );
  }

  // 14-day trend series aligned to the trailing window
  const series: string[] = [];
  for (let d = trendStart; d <= date; d = addDays(d, 1)) series.push(d);
  const byDate = new Map((days ?? []).map((d) => [d.local_date, d]));
  const sleepTrend = series.map((d) => byDate.get(d)?.duration_asleep_s ?? null);
  const recoveryTrend = series.map((d) => byDate.get(d)?.recovery_score ?? null);
  const strainTrend = series.map((d) => byDate.get(d)?.day_strain ?? byDate.get(d)?.workouts_duration_s ?? null);

  const bandIntervals = [
    ...(daySleep ?? []).map((s) => ({
      start: s.start_at,
      end: s.end_at,
      kind: s.is_nap ? ("nap" as const) : ("sleep" as const),
    })),
    ...(dayWorkouts ?? []).map((w) => ({ start: w.start_at, end: w.end_at, kind: "workout" as const })),
  ];

  const isToday = date === today;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">{isToday ? "Today" : "Day report"}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {fmtDateLong(date)}
          </h1>
        </div>
        <nav className="metric flex items-center gap-1 text-sm" aria-label="Change day">
          <Link
            href={`/dashboard?date=${addDays(date, -1)}`}
            className="rounded-md border border-hairline px-2.5 py-1.5 hover:bg-card"
            aria-label="Previous day"
          >
            ←
          </Link>
          <Link
            href="/dashboard"
            aria-disabled={isToday}
            className={`rounded-md border border-hairline px-2.5 py-1.5 ${isToday ? "pointer-events-none opacity-40" : "hover:bg-card"}`}
          >
            Today
          </Link>
          <Link
            href={`/dashboard?date=${addDays(date, 1)}`}
            aria-disabled={isToday}
            className={`rounded-md border border-hairline px-2.5 py-1.5 ${isToday ? "pointer-events-none opacity-40" : "hover:bg-card"}`}
            aria-label="Next day"
          >
            →
          </Link>
        </nav>
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-card px-5 pb-2 pt-4">
        <p className="eyebrow mb-2">The shape of the day</p>
        <DayBand date={date} intervals={bandIntervals} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* SLEEP */}
        <Link
          href="/sleep"
          className="group rounded-xl border border-hairline bg-card p-5 transition-colors hover:border-hairline-strong"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow" style={{ color: "var(--sleep)" }}>
              Sleep
            </p>
            <Sparkline values={sleepTrend} color="var(--sleep)" />
          </div>
          <p className="metric mt-3 text-4xl">
            {summary?.duration_asleep_s != null ? fmtClockDuration(summary.duration_asleep_s) : "—"}
            {summary?.duration_asleep_s != null && (
              <span className="ml-1 text-base text-faint">asleep</span>
            )}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-faint">Score</dt>
              <dd className="metric mt-0.5">{summary?.sleep_score != null ? Math.round(summary.sleep_score) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">In bed</dt>
              <dd className="metric mt-0.5">{fmtClockDuration(summary?.time_in_bed_s)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Window</dt>
              <dd className="metric mt-0.5 whitespace-nowrap">
                {summary?.sleep_start_at
                  ? `${fmtTimeCompact(summary.sleep_start_at)}–${fmtTimeCompact(summary.sleep_end_at)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </Link>

        {/* RECOVERY */}
        <Link
          href="/recovery"
          className="group rounded-xl border border-hairline bg-card p-5 transition-colors hover:border-hairline-strong"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow" style={{ color: "var(--recovery)" }}>
              Recovery
            </p>
            <Sparkline values={recoveryTrend} color="var(--recovery)" />
          </div>
          <p className="metric mt-3 text-4xl">
            {summary?.recovery_score != null ? `${Math.round(summary.recovery_score)}%` : "—"}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-faint">HRV</dt>
              <dd className="metric mt-0.5">
                {summary?.recovery_hrv_ms != null ? `${Math.round(summary.recovery_hrv_ms)} ms` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Resting HR</dt>
              <dd className="metric mt-0.5">
                {summary?.resting_hr_bpm != null ? `${Math.round(summary.resting_hr_bpm)}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Day strain</dt>
              <dd className="metric mt-0.5">
                {summary?.day_strain != null ? summary.day_strain.toFixed(1) : "—"}
              </dd>
            </div>
          </dl>
        </Link>

        {/* ACTIVITY */}
        <Link
          href="/activity"
          className="group rounded-xl border border-hairline bg-card p-5 transition-colors hover:border-hairline-strong"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow" style={{ color: "var(--activity)" }}>
              Activity
            </p>
            <Sparkline values={strainTrend} color="var(--activity)" />
          </div>
          <p className="metric mt-3 text-4xl">
            {summary?.workout_count ? fmtDuration(summary.workouts_duration_s) : "Rest"}
            {!!summary?.workout_count && (
              <span className="ml-1 text-base text-faint">
                · {summary.workout_count} {summary.workout_count === 1 ? "session" : "sessions"}
              </span>
            )}
          </p>
          {dayWorkouts?.length ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {dayWorkouts.slice(0, 3).map((w) => (
                <li key={w.id} className="flex items-baseline justify-between">
                  <span>{sportLabel(w.sport)}</span>
                  <span className="metric text-xs text-muted">
                    {fmtDuration(w.duration_s)}
                    {w.distance_m ? ` · ${fmtKm(w.distance_m)}` : ""}
                  </span>
                </li>
              ))}
              {dayWorkouts.length > 3 && (
                <li className="text-xs text-faint">+{dayWorkouts.length - 3} more</li>
              )}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-faint">No workouts logged.</p>
          )}
        </Link>
      </div>

      {(daySleep?.length ?? 0) > 1 && (
        <p className="mt-4 text-xs text-faint">
          {daySleep!.length} sleep sources reported this night — the card shows the primary
          session; see <Link href="/sleep" className="underline">Sleep</Link> for all of them.
        </p>
      )}
    </div>
  );
}
