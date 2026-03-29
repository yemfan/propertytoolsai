-- RPC: single active LeadSmart Agent entitlement row (uses active_product_entitlements view).

create or replace function public.get_active_agent_entitlement(p_user_id uuid)
returns table (
  entitlement_id uuid,
  user_id uuid,
  product text,
  plan text,
  cma_reports_per_day integer,
  max_leads integer,
  max_contacts integer,
  alerts_level text,
  reports_download_level text,
  team_access boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.id,
    e.user_id,
    e.product,
    e.plan,
    e.cma_reports_per_day,
    e.max_leads,
    e.max_contacts,
    e.alerts_level,
    e.reports_download_level,
    e.team_access
  from public.active_product_entitlements e
  where e.user_id = p_user_id
    and e.product = 'leadsmart_agent'
  limit 1;
$$;

comment on function public.get_active_agent_entitlement(uuid) is
  'Returns at most one active leadsmart_agent entitlement for the user (active flag + date window).';

grant execute on function public.get_active_agent_entitlement(uuid) to authenticated;
grant execute on function public.get_active_agent_entitlement(uuid) to service_role;
