-- Fix: "Could not find the 'user_id' column of 'users' in the schema cache"
-- Run in Supabase → SQL Editor.

-- 1) Ensure the column exists (older DBs may have created `users` without it).
alter table public.users add column if not exists user_id uuid;

-- 2) Do not copy id → user_id here: id is often bigint while user_id is uuid (Supabase auth).
--    Populate user_id from auth.users / your app when linking accounts.

-- 3) Ensure `upsert(..., { onConflict: 'user_id' })` works.
create unique index if not exists idx_users_user_id on public.users(user_id);

