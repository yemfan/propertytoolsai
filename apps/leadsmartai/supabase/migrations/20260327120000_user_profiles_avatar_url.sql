-- Profile photo URL (public Storage URL after upload via /api/me/avatar).
alter table public.user_profiles
  add column if not exists avatar_url text;

comment on column public.user_profiles.avatar_url is 'Public URL for profile photo (Supabase Storage avatars bucket).';

-- Bucket creation: migration 20260473570000_storage_bucket_avatars.sql (or Dashboard → Storage).
