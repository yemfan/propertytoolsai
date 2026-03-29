-- Profiles for Supabase Auth users (separate from legacy public.user_profiles if present).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'consumer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
