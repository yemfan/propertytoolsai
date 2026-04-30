-- Fix auth signup trigger: 20260317000000 inserted into public.profiles, which 20260473550000 drops.
-- Without this, new auth users can exist with no public.user_profiles row (OAuth/email edge cases).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(both from concat_ws(
      ' ',
      nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'family_name'), '')
    )), ''),
    ''
  );

  if v_full_name = '' then
    v_full_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    );
  end if;

  v_phone := nullif(trim(new.raw_user_meta_data->>'phone_e164'), '');

  insert into public.user_profiles (user_id, full_name, email, phone)
  values (new.id, v_full_name, new.email, v_phone)
  on conflict (user_id) do update set
    email = coalesce(excluded.email, public.user_profiles.email),
    full_name = case
      when nullif(excluded.full_name, '') is not null then excluded.full_name
      else public.user_profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.user_profiles.phone);

  insert into public.leadsmart_users (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  insert into public.propertytools_users (user_id, tier)
  values (new.id, 'basic')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'After insert on auth.users: ensure user_profiles + leadsmart_users + propertytools_users (replaces legacy public.profiles insert).';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
