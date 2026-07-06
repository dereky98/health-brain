-- Fixes from supabase security advisors:
-- 1. pin search_path on functions
-- 2. trigger functions must not be callable through the REST RPC surface
-- 3. keep pg_net out of the public schema

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  alter extension pg_net set schema extensions;
exception
  when others then
    -- not relocatable on this version: recreate in place
    drop extension if exists pg_net;
    create extension pg_net with schema extensions;
end;
$$;
