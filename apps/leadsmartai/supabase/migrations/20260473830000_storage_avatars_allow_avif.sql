-- Allow AVIF uploads (Android / modern browsers) for POST /api/me/avatar.
update storage.buckets
set allowed_mime_types = coalesce(allowed_mime_types, array[]::text[]) || array['image/avif']::text[]
where id = 'avatars'
  and not (coalesce(allowed_mime_types, array[]::text[]) @> array['image/avif']::text[]);
