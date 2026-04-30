-- PostgREST / Supabase JS: .upsert(..., { onConflict: "auth_user_id" }) emits
-- INSERT ... ON CONFLICT ("auth_user_id") ...
-- A *partial* unique index (WHERE auth_user_id IS NOT NULL) does NOT satisfy that
-- inference — Postgres raises: 42P10 — no unique or exclusion constraint matching ON CONFLICT.
-- Fix: non-partial UNIQUE on auth_user_id (PostgreSQL still allows multiple NULLs).

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'agents'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'agents'
      and indexname = 'idx_agents_auth_user_id_upsert'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'agents'
      and indexname = 'idx_agents_auth_user_id_unique'
  ) then
    drop index public.idx_agents_auth_user_id_unique;
  end if;

  if exists (
    select 1 from public.agents
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) then
    raise notice 'agents: duplicate non-null auth_user_id rows exist; resolve duplicates then add UNIQUE(auth_user_id) manually.';
    return;
  end if;

  create unique index idx_agents_auth_user_id_upsert
    on public.agents (auth_user_id);
exception
  when duplicate_object then null;
  when unique_violation then
    raise notice 'agents: could not add UNIQUE(auth_user_id) (violates uniqueness).';
end;
$$;
