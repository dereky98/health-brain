-- RLS: clients may read only their own rows. There are deliberately NO
-- insert/update/delete policies on health data — all writes go through edge
-- functions running as service_role, which bypasses RLS.

-- profiles: read + update own row (display_name, timezone)
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- provider_connections: read-only for clients (status badges, last sync)
alter table public.provider_connections enable row level security;

create policy "read own connections" on public.provider_connections
  for select using ((select auth.uid()) = user_id);

-- canonical health data: read-only for clients
alter table public.sleep_sessions enable row level security;

create policy "read own sleep" on public.sleep_sessions
  for select using ((select auth.uid()) = user_id);

alter table public.workouts enable row level security;

create policy "read own workouts" on public.workouts
  for select using ((select auth.uid()) = user_id);

alter table public.recovery_metrics enable row level security;

create policy "read own recovery" on public.recovery_metrics
  for select using ((select auth.uid()) = user_id);

-- private schema tables: not exposed via PostgREST at all, but enable RLS with
-- no policies as defense in depth (service_role bypasses RLS).
alter table private.provider_credentials enable row level security;
alter table private.oauth_states enable row level security;
alter table private.webhook_events enable row level security;
alter table private.api_keys enable row level security;
