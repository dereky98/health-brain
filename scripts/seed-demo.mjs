// Seeds ~30 days of plausible demo data for a local dev user so the dashboard
// can be exercised without live provider connections.
//
//   node scripts/seed-demo.mjs [email]   (default demo@test.local / demo-password-123!)
//
// Local stack only: reads keys from `supabase status`.
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2] ?? "demo@test.local";
const password = "demo-password-123!";

const status = execSync("supabase status -o env", { encoding: "utf8" });
const get = (name) => status.match(new RegExp(`^${name}="(.*)"$`, "m"))[1];
const admin = createClient(get("API_URL"), get("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// deterministic pseudo-random so reruns look the same
let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const jitter = (base, spread) => base + (rand() - 0.5) * 2 * spread;

const { data: existing } = await admin.auth.admin.listUsers();
let user = existing.users.find((u) => u.email === email);
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
console.log(`user ${email} -> ${user.id}`);

const days = 30;
const today = new Date();
const iso = (d) => d.toISOString();
const dateStr = (d) => d.toLocaleDateString("en-CA");

const sleep = [];
const recovery = [];
const workouts = [];

for (let i = days; i >= 1; i--) {
  const day = new Date(today.getTime() - i * 86400_000);
  const dStr = dateStr(day);

  // night: 23:10 previous day -> 07:05
  const bedtime = new Date(day.getTime() - 86400_000);
  bedtime.setHours(23, Math.floor(jitter(10, 35)), 0, 0);
  const wake = new Date(day);
  wake.setHours(7, Math.floor(jitter(5, 30)), 0, 0);
  const inBed = Math.floor((wake - bedtime) / 1000);
  const asleep = Math.floor(inBed * jitter(0.9, 0.04));
  const deep = Math.floor(asleep * jitter(0.2, 0.04));
  const rem = Math.floor(asleep * jitter(0.25, 0.05));
  const light = asleep - deep - rem;
  const hrv = jitter(62, 14);
  const rhr = jitter(50, 4);
  const sleepScore = Math.min(99, Math.max(35, jitter(82, 12)));

  sleep.push({
    user_id: user.id, provider: "whoop", external_id: `demo-whoop-sleep-${dStr}`,
    start_at: iso(bedtime), end_at: iso(wake), local_date: dStr, timezone: "UTC-08:00",
    duration_asleep_s: asleep, time_in_bed_s: inBed, efficiency_pct: (asleep / inBed) * 100,
    stage_deep_s: deep, stage_rem_s: rem, stage_light_s: light, stage_awake_s: inBed - asleep,
    hrv_rmssd_ms: hrv, respiratory_rate: jitter(14.5, 0.8), score: sleepScore, is_nap: false,
    raw: { demo: true },
  });
  sleep.push({
    user_id: user.id, provider: "eight_sleep", external_id: `demo-8s-${dStr}`,
    start_at: iso(new Date(bedtime.getTime() - 300_000)), end_at: iso(new Date(wake.getTime() + 480_000)),
    local_date: dStr, timezone: "America/Los_Angeles",
    duration_asleep_s: Math.floor(asleep * jitter(1.02, 0.03)), time_in_bed_s: inBed + 780,
    efficiency_pct: jitter(88, 4), stage_deep_s: Math.floor(deep * 1.05), stage_rem_s: rem,
    stage_light_s: light, stage_awake_s: inBed - asleep, hr_avg_bpm: jitter(54, 3),
    hr_lowest_bpm: rhr - 2, hrv_rmssd_ms: hrv * 0.95, respiratory_rate: jitter(14.2, 0.6),
    temp_c: jitter(29, 1.5), score: Math.max(30, sleepScore - 4), is_nap: false, raw: { demo: true },
  });

  recovery.push({
    user_id: user.id, provider: "whoop", external_id: `demo-cycle-${dStr}`, local_date: dStr,
    recovery_score: Math.min(99, Math.max(10, jitter(sleepScore - 10, 15))),
    hrv_rmssd_ms: hrv, resting_hr_bpm: rhr, spo2_pct: jitter(97, 1), skin_temp_c: jitter(33.4, 0.4),
    day_strain: jitter(11, 4), day_kcal: jitter(2300, 350), raw: { demo: true },
  });

  // train ~5 days a week
  if (rand() > 0.28) {
    const isRun = rand() > 0.45;
    const start = new Date(day);
    start.setHours(rand() > 0.5 ? 7 : 17, Math.floor(rand() * 50), 0, 0);
    const dur = Math.floor(jitter(isRun ? 2900 : 3900, 900));
    workouts.push({
      user_id: user.id, provider: "strava", external_id: `demo-strava-${dStr}`,
      start_at: iso(start), end_at: iso(new Date(start.getTime() + dur * 1000)), local_date: dStr,
      timezone: "America/Los_Angeles", sport: isRun ? "run" : "ride",
      provider_sport: isRun ? "Run" : "Ride", duration_s: dur, moving_s: Math.floor(dur * 0.94),
      distance_m: isRun ? jitter(8500, 2500) : jitter(28000, 9000),
      elevation_gain_m: jitter(isRun ? 90 : 420, 60), calories_kcal: jitter(isRun ? 520 : 780, 140),
      avg_hr_bpm: jitter(151, 9), max_hr_bpm: jitter(176, 7),
      avg_power_w: isRun ? null : jitter(205, 30), strain: null, raw: { demo: true },
    });
    if (rand() > 0.6) {
      const s2 = new Date(day); s2.setHours(12, 15, 0, 0);
      workouts.push({
        user_id: user.id, provider: "whoop", external_id: `demo-whoop-wo-${dStr}`,
        start_at: iso(s2), end_at: iso(new Date(s2.getTime() + 2700_000)), local_date: dStr,
        timezone: "UTC-08:00", sport: "strength", provider_sport: "Weightlifting",
        duration_s: 2700, distance_m: null, calories_kcal: jitter(280, 60),
        avg_hr_bpm: jitter(118, 10), max_hr_bpm: jitter(155, 10), strain: jitter(9, 2.5),
        raw: { demo: true },
      });
    }
  }
}

const connections = ["whoop", "strava", "eight_sleep"].map((provider) => ({
  user_id: user.id, provider, provider_user_id: `demo-${provider}`,
  status: "active", last_synced_at: new Date().toISOString(),
  next_sync_at: new Date(Date.now() + 900_000).toISOString(),
  sync_cursor: {},
}));

for (const [table, rows] of [
  ["provider_connections", connections],
  ["sleep_sessions", sleep],
  ["workouts", workouts],
  ["recovery_metrics", recovery],
]) {
  const conflict = table === "provider_connections" ? "user_id,provider" : "user_id,provider,external_id";
  const { error } = await admin.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows`);
}
console.log("seeded. sign in with", email, "/", password);
