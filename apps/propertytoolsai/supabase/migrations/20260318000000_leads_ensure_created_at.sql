-- public.leads.created_at is required by idx_leads_agent_id_created_at in
-- 20260319_dashboard_drilldown.sql and 20260319_bundle_all.sql.
-- Prefer 20250310100000_leads_ensure_created_at.sql (runs earlier). This file is idempotent.

alter table if exists public.leads
  add column if not exists created_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'last_activity_at'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'next_contact_at'
  ) then
    update public.leads
    set created_at = coalesce(created_at, last_activity_at, next_contact_at, now())
    where created_at is null;
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'last_activity_at'
  ) then
    update public.leads
    set created_at = coalesce(created_at, last_activity_at, now())
    where created_at is null;
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) then
    update public.leads
    set created_at = coalesce(created_at, now())
    where created_at is null;
  end if;
end $$;

alter table if exists public.leads
  alter column created_at set default now();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'created_at'
  )
  and not exists (select 1 from public.leads where created_at is null limit 1) then
    alter table public.leads alter column created_at set not null;
  end if;
end $$;
