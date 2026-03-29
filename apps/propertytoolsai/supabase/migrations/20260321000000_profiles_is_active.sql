-- Optional flag for disabling access without deleting the profile row.
alter table public.profiles
  add column if not exists is_active boolean not null default true;
