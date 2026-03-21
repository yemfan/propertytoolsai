-- Create a dedicated profile table for Supabase Auth users.
-- This avoids conflicts with any existing `public.users` table that may store local-auth fields
-- like `password_hash` and other NOT NULL columns.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  full_name text,
  license_number text,
  brokerage text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_created_at on public.user_profiles(created_at desc);

