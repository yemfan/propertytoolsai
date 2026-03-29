-- Idempotent repair for databases that hit 42703 on leads.created_at before
-- 20260318000000_leads_ensure_created_at.sql existed. Safe if column already exists.

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
      and column_name = 'agent_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists idx_leads_agent_id_created_at on public.leads (agent_id, created_at desc)';
  end if;
end $$;
