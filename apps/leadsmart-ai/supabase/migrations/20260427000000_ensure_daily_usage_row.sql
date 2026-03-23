-- Ensures a usage row exists for today (session `current_date`) for idempotent daily metering.

create or replace function public.ensure_daily_usage_row(
  p_user_id uuid,
  p_product text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.entitlement_usage_daily (
    user_id,
    product,
    usage_date
  )
  values (
    p_user_id,
    p_product,
    current_date
  )
  on conflict (user_id, product, usage_date) do nothing;
end;
$$;

comment on function public.ensure_daily_usage_row(uuid, text) is
  'Upsert-noop: creates entitlement_usage_daily for (user, product, current_date) if missing.';

grant execute on function public.ensure_daily_usage_row(uuid, text) to authenticated;
grant execute on function public.ensure_daily_usage_row(uuid, text) to service_role;
