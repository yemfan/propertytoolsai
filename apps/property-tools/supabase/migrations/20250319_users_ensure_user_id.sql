-- Fix: "Could not find the 'user_id' column of 'users' in the schema cache"
-- Run in Supabase → SQL Editor.

-- 1) Ensure the column exists (older DBs may have created `users` without it).
alter table public.users add column if not exists user_id uuid;

-- 2) Best-effort backfill if an older row-store used `id` instead.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) then
    update public.users set user_id = id where user_id is null;
  end if;
end $$;

-- 3) Ensure `upsert(..., { onConflict: 'user_id' })` works.
create unique index if not exists idx_users_user_id on public.users(user_id);

