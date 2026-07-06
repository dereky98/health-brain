-- Polling scheduler: pg_cron fires the sync/run edge function every 15 minutes.
-- The function drains due provider_connections (next_sync_at <= now) and
-- re-drives failed webhook events. Configuration lives in two DB settings so
-- the same migration works locally and in production:
--   select set_config('app.settings.functions_url', 'https://<ref>.supabase.co/functions/v1', false);
-- We read them via current_setting(..., true) with sensible local defaults.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function private.invoke_sync_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text := coalesce(
    nullif(current_setting('app.settings.functions_url', true), ''),
    'http://host.docker.internal:55321/functions/v1'  -- local stack: db container -> host gateway
  );
  secret text := coalesce(nullif(current_setting('app.settings.sync_secret', true), ''), 'local-sync-secret');
begin
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

select cron.schedule(
  'sync-run-every-15min',
  '*/15 * * * *',
  $$select private.invoke_sync_run()$$
);
