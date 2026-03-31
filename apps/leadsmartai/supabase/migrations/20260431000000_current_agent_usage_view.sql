-- All daily usage rows for LeadSmart AI Agent (any date).

create or replace view public.current_agent_usage as
select
  u.user_id,
  u.product,
  u.usage_date,
  u.cma_reports_used,
  u.leads_used,
  u.contacts_used,
  u.report_downloads_used
from public.entitlement_usage_daily u
where u.product = 'leadsmart_agent';

comment on view public.current_agent_usage is
  'Metering snapshots from entitlement_usage_daily for product leadsmart_agent.';

grant select on public.current_agent_usage to authenticated;
grant select on public.current_agent_usage to service_role;
