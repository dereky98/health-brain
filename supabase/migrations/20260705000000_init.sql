-- Core schema: private schema, enums, profiles, provider connections + credentials.

create schema if not exists private;

-- The private schema is never exposed through PostgREST (not in config.toml api.schemas).
-- Only the service role (edge functions) touches it.
grant usage on schema private to service_role;
alter default privileges in schema private grant all on tables to service_role;
alter default privileges in schema private grant all on sequences to service_role;

create type public.provider_slug as enum ('whoop', 'strava', 'eight_sleep');
create type public.connection_status as enum ('active', 'error', 'reauth_required', 'disconnected');

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, auto-created on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- provider_connections: one per user per provider (status is client-visible)
-- ---------------------------------------------------------------------------
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.provider_slug not null,
  provider_user_id text,
  status public.connection_status not null default 'active',
  scopes text[],
  last_synced_at timestamptz,
  last_sync_error text,
  sync_cursor jsonb not null default '{}',
  next_sync_at timestamptz not null default now(),
  consecutive_failures int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index provider_connections_due_idx
  on public.provider_connections (next_sync_at)
  where status = 'active';
create index provider_connections_webhook_idx
  on public.provider_connections (provider, provider_user_id);

create trigger provider_connections_updated_at
  before update on public.provider_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- private.provider_credentials: encrypted OAuth tokens (AES-256-GCM app-layer)
-- ---------------------------------------------------------------------------
create table private.provider_credentials (
  connection_id uuid primary key references public.provider_connections (id) on delete cascade,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  enc_key_version int not null default 1,
  -- Whoop/Strava rotate refresh tokens (single use): exactly one refresher at a time.
  refresh_lock_until timestamptz,
  updated_at timestamptz not null default now()
);

create trigger provider_credentials_updated_at
  before update on private.provider_credentials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- private.oauth_states: short-lived CSRF state for OAuth flows (web + iOS)
-- ---------------------------------------------------------------------------
create table private.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.provider_slug not null,
  platform text not null default 'web' check (platform in ('web', 'ios')),
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index oauth_states_expiry_idx on private.oauth_states (expires_at);
