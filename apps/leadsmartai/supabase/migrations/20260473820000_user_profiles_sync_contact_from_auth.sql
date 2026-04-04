-- Align public.user_profiles name/email/phone with auth.users (canonical source).
-- Also backfill auth.users.phone from signup metadata when the column was empty.

update auth.users u
set phone = nullif(btrim(u.raw_user_meta_data->>'phone_e164'), '')
where (u.phone is null or btrim(u.phone) = '')
  and coalesce(btrim(u.raw_user_meta_data->>'phone_e164'), '') <> '';

update public.user_profiles p
set
  email = coalesce(nullif(trim(u.email), ''), p.email),
  phone = case
    when u.phone is not null and trim(u.phone) <> '' then trim(u.phone)
    else p.phone
  end,
  full_name = coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data->>'name', '')), ''),
    p.full_name
  )
from auth.users u
where p.user_id = u.id;
