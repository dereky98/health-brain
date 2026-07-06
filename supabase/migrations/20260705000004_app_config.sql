-- Hosted Supabase doesn't permit ALTER DATABASE ... SET for custom GUCs, so the
-- cron scheduler reads its endpoint + secret from a config table instead.

create table if not exists private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table private.app_config enable row level security;

-- Local defaults; production values are inserted per-environment.
insert into private.app_config (key, value) values
  ('functions_url', 'http://host.docker.internal:55321/functions/v1'),
  ('sync_secret', 'local-sync-secret')
on conflict (key) do nothing;

create or replace function private.invoke_sync_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select value into base_url from private.app_config where key = 'functions_url';
  select value into secret from private.app_config where key = 'sync_secret';
  if base_url is null or secret is null then
    raise warning 'invoke_sync_run: app_config missing functions_url or sync_secret';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/sync/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
