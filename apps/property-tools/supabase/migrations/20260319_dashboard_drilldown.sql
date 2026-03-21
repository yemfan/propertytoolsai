-- Dashboard drill-down support (overview + filtered lead list)
-- Safe to re-run (IF EXISTS / IF NOT EXISTS).
--
-- NOTE:
-- Most required columns/tables are already created by:
-- - 20250319_leads_followups_and_engagement_all.sql (leads rating/engagement + lead_events + communications)
-- - 20250319_smart_automation.sql (automation_logs)
--
-- This migration just ensures the common dashboard filter indexes exist.

-- Leads filtering (rating / engagement / last activity) + agent scoping
create index if not exists idx_leads_agent_id_created_at
  on public.leads(agent_id, created_at desc);

create index if not exists idx_leads_agent_id_rating
  on public.leads(agent_id, rating);

create index if not exists idx_leads_agent_id_engagement_score
  on public.leads(agent_id, engagement_score desc);

create index if not exists idx_leads_agent_id_last_activity_at
  on public.leads(agent_id, last_activity_at desc);

-- Activity feed queries
create index if not exists idx_lead_events_created_at
  on public.lead_events(created_at desc);

-- Messages sent metric and timelines
create index if not exists idx_communications_created_at
  on public.communications(created_at desc);

create index if not exists idx_automation_logs_created_at
  on public.automation_logs(created_at desc);

