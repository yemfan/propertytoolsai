-- Task Management for Daily AI Briefing

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  -- leads.id is BIGINT in this project
  lead_id bigint,
  title text not null,
  description text,
  type text not null, -- call | email | follow_up
  status text not null default 'pending', -- pending | done | skipped | deferred
  due_date date not null,
  deferred_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_agent_id_status_due_date
  on public.tasks(agent_id, status, due_date);

create index if not exists idx_tasks_agent_id_deferred_until
  on public.tasks(agent_id, deferred_until);

-- Prevent obvious duplicates for a given day per lead/type/title
create unique index if not exists idx_tasks_unique_daily
  on public.tasks(agent_id, lead_id, type, due_date, title);

