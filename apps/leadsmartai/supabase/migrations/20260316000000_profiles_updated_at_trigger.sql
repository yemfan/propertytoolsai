-- Idempotent: ensures `profiles.updated_at` is maintained on UPDATE.
-- Safe if `20260315000000_create_profiles_table.sql` already included this logic.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
