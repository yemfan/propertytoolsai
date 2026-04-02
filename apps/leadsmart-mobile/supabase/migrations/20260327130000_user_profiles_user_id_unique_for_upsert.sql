-- PostgREST / Supabase JS: .upsert(..., { onConflict: "user_id" }) becomes
-- INSERT ... ON CONFLICT ("user_id") ... which requires UNIQUE or PRIMARY KEY on user_id.
-- Without it, Postgres raises: 42P10 — no unique or exclusion constraint matching ON CONFLICT.

do $$
declare
  has_single_col_uq_on_user_id boolean;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) then
    return;
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where t.relname = 'user_profiles'
      and c.contype in ('p', 'u')
      and cardinality(c.conkey) = 1
      and (
        select a.attname::text
        from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      ) = 'user_id'
  )
  into has_single_col_uq_on_user_id;

  if has_single_col_uq_on_user_id then
    return;
  end if;

  if exists (
    select 1 from public.user_profiles group by user_id having count(*) > 1
  ) then
    raise notice 'user_profiles: duplicate user_id rows exist; resolve duplicates then add UNIQUE(user_id) manually.';
    return;
  end if;

  alter table public.user_profiles
    add constraint user_profiles_user_id_upsert_key unique (user_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'user_profiles: could not add UNIQUE(user_id) (violates uniqueness).';
end;
$$;
