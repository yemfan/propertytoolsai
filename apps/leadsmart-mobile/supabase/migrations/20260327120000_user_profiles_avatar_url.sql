-- Profile photo URL (public Storage URL after upload via /api/me/avatar).
alter table public.user_profiles
  add column if not exists avatar_url text;

comment on column public.user_profiles.avatar_url is 'Public URL for profile photo (Supabase Storage avatars bucket).';

-- Create Storage bucket "avatars" in Supabase Dashboard → Storage (public, 5MB, image/*)
-- or run once in SQL editor if your project allows:
--   insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
