-- =============================================================================
-- Wipe ALL auth users + agent/CRM data + avatar storage + orphan analytics rows.
-- Schema and migrations are unchanged. Irreversible — use on dev/staging or after
-- a confirmed backup.
--
-- Run in: Supabase Dashboard → SQL Editor (role must be able to write auth.*).
-- Shared by LeadSmart + PropertyTools (same Supabase project).
-- =============================================================================

begin;

-- Profile photos (bucket from migration 20260473570000_storage_bucket_avatars.sql)
delete from storage.objects
where bucket_id = 'avatars';

-- Agent / CRM hub — public.agents is not always enforced as FK from auth.users;
-- TRUNCATE ... CASCADE clears dependent rows (leads, inbox prefs, voice settings, etc.).
truncate table public.agents restart identity cascade;

-- Removes auth users; CASCADE drops user_profiles, leadsmart_users, propertytools_users,
-- and other rows with ON DELETE CASCADE to auth.users.
delete from auth.users;

-- Tables that used ON DELETE SET NULL on user_id (anonymous rows would otherwise remain).
do $wipe$
declare
  t text;
  tbls text[] := array[
    'public.events',
    'public.home_value_sessions',
    'public.tool_events',
    'public.tool_usage_logs',
    'public.usage_events',
    'public.subscription_events',
    'public.opportunities'
  ];
begin
  foreach t in array tbls loop
    if to_regclass(t) is not null then
      execute format('truncate table %s restart identity cascade', t);
    end if;
  end loop;
end;
$wipe$;

commit;
