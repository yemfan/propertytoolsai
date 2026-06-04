-- 00060_avatars_storage.sql
-- User profile pictures: a public "avatars" storage bucket. Each user may write only
-- inside their own {user_id}/ folder; anyone may read (so the public URL renders in the
-- sidebar avatar). Idempotent — safe to re-run.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Public read.
drop policy if exists "avatars_read_all" on storage.objects;
create policy "avatars_read_all" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

-- Write only within your own folder ({user_id}/...).
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
