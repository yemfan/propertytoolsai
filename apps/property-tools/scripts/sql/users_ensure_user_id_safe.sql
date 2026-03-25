-- Run in Supabase → SQL Editor ONLY if you need user_id + index.
-- This file intentionally has NO update from id → user_id (bigint vs uuid breaks).
-- If you still see 42804 on "set user_id = id", you are running a different/old script.

alter table public.users add column if not exists user_id uuid;

create unique index if not exists idx_users_user_id on public.users(user_id);
