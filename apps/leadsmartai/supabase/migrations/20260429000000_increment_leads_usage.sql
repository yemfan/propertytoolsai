-- Increment leads_used counter for today after ensuring the daily row exists.

create or replace function public.increment_leads_usage(
  p_user_id uuid,
  p_product text default 'leadsmart_agent'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.ensure_daily_usage_row(p_user_id, p_product);

  update public.entitlement_usage_daily
  set leads_used = leads_used + 1,
      updated_at = now()
  where user_id = p_user_id
    and product = p_product
    and usage_date = current_date;
end;
$$;

comment on function public.increment_leads_usage(uuid, text) is
  'Ensures today’s entitlement_usage_daily row exists, then increments leads_used by 1.';

grant execute on function public.increment_leads_usage(uuid, text) to authenticated;
grant execute on function public.increment_leads_usage(uuid, text) to service_role;
