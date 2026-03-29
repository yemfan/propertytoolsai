-- Fix: "Could not find the 'full_name' column of 'users' in the schema cache"
-- Run this in Supabase → SQL Editor if public.users exists but is missing columns.

alter table public.users add column if not exists role text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists license_number text;
alter table public.users add column if not exists brokerage text;
alter table public.users add column if not exists created_at timestamptz not null default now();

update public.users set role = coalesce(nullif(trim(role), ''), 'user') where role is null;
alter table public.users alter column role set default 'user';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role' and is_nullable = 'YES'
  ) then
    update public.users set role = 'user' where role is null;
    alter table public.users alter column role set not null;
  end if;
end $$;
