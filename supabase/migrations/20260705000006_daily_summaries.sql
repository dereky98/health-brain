-- One row per user per local date: primary sleep, best recovery, workout
-- aggregates. security_invoker so the underlying tables' RLS applies to the
-- caller — clients can only ever see their own days.

create or replace view public.daily_summaries
with (security_invoker = true) as
with days as (
  select user_id, local_date from public.sleep_sessions
  union
  select user_id, local_date from public.workouts
  union
  select user_id, local_date from public.recovery_metrics
)
select
  d.user_id,
  d.local_date,
  -- primary sleep: longest non-nap session of the night
  s.provider        as sleep_provider,
  s.score           as sleep_score,
  s.duration_asleep_s,
  s.time_in_bed_s,
  s.efficiency_pct,
  s.hrv_rmssd_ms    as sleep_hrv_ms,
  s.respiratory_rate,
  s.start_at        as sleep_start_at,
  s.end_at          as sleep_end_at,
  -- recovery: best-scored row for the day
  r.provider        as recovery_provider,
  r.recovery_score,
  r.hrv_rmssd_ms    as recovery_hrv_ms,
  r.resting_hr_bpm,
  r.day_strain,
  r.day_kcal,
  -- workouts: day aggregates
  w.workout_count,
  w.workouts_duration_s,
  w.workouts_distance_m,
  w.workouts_kcal,
  w.max_strain
from days d
left join lateral (
  select * from public.sleep_sessions ss
  where ss.user_id = d.user_id and ss.local_date = d.local_date and not ss.is_nap
  order by ss.duration_asleep_s desc nulls last
  limit 1
) s on true
left join lateral (
  select * from public.recovery_metrics rm
  where rm.user_id = d.user_id and rm.local_date = d.local_date
  order by rm.recovery_score desc nulls last
  limit 1
) r on true
left join lateral (
  select
    count(*)::int          as workout_count,
    sum(wk.duration_s)::int as workouts_duration_s,
    sum(wk.distance_m)      as workouts_distance_m,
    sum(wk.calories_kcal)   as workouts_kcal,
    max(wk.strain)          as max_strain
  from public.workouts wk
  where wk.user_id = d.user_id and wk.local_date = d.local_date
) w on true;
