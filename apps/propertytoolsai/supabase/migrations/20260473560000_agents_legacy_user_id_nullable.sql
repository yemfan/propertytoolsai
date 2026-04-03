-- Legacy CRM used agents.user_id (often bigint). New rows are linked via auth_user_id (uuid) only.
-- Inserts that set auth_user_id + plan_type but omit user_id were failing with 23502.
do $agents_user_id$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'user_id'
  ) then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'user_id'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.agents alter column user_id drop not null';
  end if;
end;
$agents_user_id$;

comment on column public.agents.user_id is
  'Legacy CRM user id when present; auth-linked rows may use auth_user_id only.';
