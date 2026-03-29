-- Agent Performance Dashboard support
-- Optimizes queries used by /api/performance/*
-- Safe to re-run (IF NOT EXISTS).

-- Tasks: filter by agent + status + updated_at (7‑day windows, trends)
create index if not exists idx_tasks_agent_id_status_updated_at
  on public.tasks(agent_id, status, updated_at desc);

-- Communications: lookups by agent + lead + created_at for response-time metrics
create index if not exists idx_communications_agent_id_lead_id_created_at
  on public.communications(agent_id, lead_id, created_at desc);

-- Lead events: engagement trends over time
create index if not exists idx_lead_events_agent_id_created_at
  on public.lead_events(agent_id, created_at desc);

