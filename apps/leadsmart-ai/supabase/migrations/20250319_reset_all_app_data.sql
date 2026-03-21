-- Reset all app-owned data (clean slate) without touching Supabase Auth tables.
-- Safe to re-run. Intended for DEV only.
--
-- NOTE:
-- - This does NOT delete `auth.users` (do that via Supabase Dashboard → Authentication → Users).
-- - TRUNCATE ... CASCADE will remove dependent rows via foreign keys.

begin;

-- If some tables don't exist in your project yet, TRUNCATE would error.
-- So we conditionally truncate them.
do $$
declare
  t text;
  tables text[] := array[
    'public.usage_logs',
    'public.notifications',
    'public.reports',
    'public.presentations',
    'public.leads',
    'public.contacts',
    'public.agents',
    'public.user_profiles'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = split_part(t, '.', 1)
        and table_name = split_part(t, '.', 2)
    ) then
      execute format('truncate table %s restart identity cascade', t);
    end if;
  end loop;
end $$;

commit;

