-- RealtorBoss — Boss Assistant instructions + briefing read state.
--
-- The morning briefing becomes dismissible (read_at), the evening
-- summary is retired (generation removed in code; old rows remain),
-- and the card's space hosts a free-form instruction channel: the
-- Realtor writes what they need, a 5-minute cron has the Boss
-- Assistant parse it into discrete tasks and route each one — to the
-- AI assistant whose job it is, or to the Realtor for review.
--
-- Consumers (same PR):
--   • /api/dashboard/briefings/read            — mark morning briefing read
--   • /api/dashboard/realtorboss/instructions  — submit + list
--   • /api/cron/boss-instructions              — parse + route (*/5)

alter table public.daily_briefings
  add column if not exists read_at timestamptz;

-- ── boss_instructions — the Realtor's free-form asks ──────────────

create table if not exists public.boss_instructions (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  content text not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'done', 'failed')
  ),
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boss_instructions_pending
  on public.boss_instructions(created_at)
  where status = 'pending';
create index if not exists idx_boss_instructions_agent
  on public.boss_instructions(agent_id, created_at desc);

alter table public.boss_instructions enable row level security;

drop policy if exists "boss_instructions_select_own" on public.boss_instructions;
create policy "boss_instructions_select_own" on public.boss_instructions
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = boss_instructions.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.boss_instructions is
  'Free-form instructions from the Realtor to the Boss Assistant. A 5-minute cron parses pending rows into boss_instruction_tasks and routes each task to an AI assistant or to the Realtor.';

-- ── boss_instruction_tasks — the parsed, routed task list ─────────

create table if not exists public.boss_instruction_tasks (
  id uuid primary key default gen_random_uuid(),
  instruction_id uuid not null references public.boss_instructions(id) on delete cascade,
  agent_id bigint not null references public.agents(id) on delete cascade,
  title text not null,
  details text,
  -- Which team member the Boss routed it to; 'realtor' = needs the human.
  assigned_to text not null check (
    assigned_to in (
      'receptionist', 'sales_assistant', 'marketing_assistant',
      'transaction_assistant', 'accountant', 'realtor'
    )
  ),
  status text not null default 'assigned' check (
    status in ('assigned', 'needs_review', 'done', 'dismissed')
  ),
  -- When routed to the Realtor we also create a crm_tasks row so it
  -- shows up in their real task list; linked here.
  crm_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boss_instruction_tasks_agent
  on public.boss_instruction_tasks(agent_id, created_at desc);

alter table public.boss_instruction_tasks enable row level security;

drop policy if exists "boss_instruction_tasks_select_own" on public.boss_instruction_tasks;
create policy "boss_instruction_tasks_select_own" on public.boss_instruction_tasks
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = boss_instruction_tasks.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

comment on table public.boss_instruction_tasks is
  'Tasks the Boss Assistant extracted from a boss_instructions row, each routed to an AI assistant (status=assigned) or to the Realtor (status=needs_review, mirrored into crm_tasks).';
