-- Canonical health-data tables. Units are normalized at ingest:
-- durations s, distance m, temperature °C, HR bpm, HRV RMSSD ms, energy kcal, scores 0-100.
-- Every row keeps the lossless provider payload in `raw` and dedups on
-- (user_id, provider, external_id) so ingestion is idempotent upsert.

-- ---------------------------------------------------------------------------
-- sleep_sessions (whoop, eight_sleep)
-- ---------------------------------------------------------------------------
create table public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.provider_slug not null,
  external_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- local date of end_at ("the night you woke up on"); drives daily rollups
  local_date date not null,
  timezone text,
  duration_asleep_s int,
  time_in_bed_s int,
  latency_s int,
  efficiency_pct numeric(5,2),
  stage_deep_s int,
  stage_rem_s int,
  stage_light_s int,
  stage_awake_s int,
  hr_avg_bpm numeric(5,1),
  hr_lowest_bpm numeric(5,1),
  hrv_rmssd_ms numeric(6,2),
  respiratory_rate numeric(4,1),
  temp_c numeric(4,2),
  score numeric(5,2),
  is_nap boolean not null default false,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

create index sleep_sessions_user_date_idx on public.sleep_sessions (user_id, local_date desc);

create trigger sleep_sessions_updated_at
  before update on public.sleep_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workouts (whoop, strava)
-- ---------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.provider_slug not null,
  external_id text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  local_date date not null,
  timezone text,
  sport text not null,
  provider_sport text,
  duration_s int,
  moving_s int,
  distance_m numeric(10,1),
  elevation_gain_m numeric(8,1),
  calories_kcal numeric(7,1),
  avg_hr_bpm numeric(5,1),
  max_hr_bpm numeric(5,1),
  avg_power_w numeric(6,1),
  strain numeric(5,2),
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

create index workouts_user_date_idx on public.workouts (user_id, local_date desc);

create trigger workouts_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recovery_metrics (whoop cycles; future oura readiness)
-- ---------------------------------------------------------------------------
create table public.recovery_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.provider_slug not null,
  external_id text not null,
  local_date date not null,
  recovery_score numeric(5,2),
  hrv_rmssd_ms numeric(6,2),
  resting_hr_bpm numeric(5,1),
  spo2_pct numeric(5,2),
  skin_temp_c numeric(4,2),
  day_strain numeric(5,2),
  day_kcal numeric(7,1),
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

create index recovery_metrics_user_date_idx on public.recovery_metrics (user_id, local_date desc);

create trigger recovery_metrics_updated_at
  before update on public.recovery_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- private.webhook_events: durable inbox + retry queue for provider webhooks
-- ---------------------------------------------------------------------------
create table private.webhook_events (
  id bigint generated always as identity primary key,
  provider public.provider_slug not null,
  event_type text,
  external_user_id text,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index webhook_events_queue_idx
  on private.webhook_events (status, received_at)
  where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- private.api_keys: personal access tokens for the MCP server
-- ---------------------------------------------------------------------------
create table private.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  key_hash text not null unique, -- sha256 hex of the "hag_..." token (shown once at creation)
  key_prefix text not null,      -- first 12 chars, for display ("hag_ab12cd…")
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index api_keys_user_idx on private.api_keys (user_id);
