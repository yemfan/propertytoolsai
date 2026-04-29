-- Automated marketing plans with step-based execution.
-- Agents generate plans from templates, customize, approve, then the system executes.

create table if not exists public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  lead_id bigint references public.leads (id) on delete set null,
  template_key text not null,
  title text not null,
  status text not null default 'draft',
  trigger_type text,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_plans_status_chk
    check (status in ('draft', 'approved', 'active', 'paused', 'completed', 'cancelled')),
  constraint marketing_plans_trigger_chk
    check (trigger_type is null or trigger_type in ('manual', 'new_lead', 'new_listing', 'recent_sale', 'stale_lead'))
);

create table if not exists public.marketing_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.marketing_plans (id) on delete cascade,
  step_order int not null,
  channel text not null,
  action text not null,
  subject text,
  body text not null,
  delay_days int not null default 0,
  enabled boolean not null default true,
  status text not null default 'pending',
  executed_at timestamptz,
  execution_result jsonb,
  created_at timestamptz not null default now(),

  constraint marketing_plan_steps_channel_chk
    check (channel in ('sms', 'email', 'task', 'notification')),
  constraint marketing_plan_steps_action_chk
    check (action in ('send_sms', 'send_email', 'create_task', 'send_notification')),
  constraint marketing_plan_steps_status_chk
    check (status in ('pending', 'scheduled', 'executed', 'skipped', 'failed'))
);

comment on table public.marketing_plans is 'Agent marketing plans: generated from templates, customizable, approvable, auto-executed.';
comment on table public.marketing_plan_steps is 'Individual steps within a marketing plan: SMS, email, task, or notification actions.';

create index if not exists idx_marketing_plans_agent_status
  on public.marketing_plans (agent_id, status);

create index if not exists idx_marketing_plans_active
  on public.marketing_plans (status, updated_at)
  where status = 'active';

create index if not exists idx_marketing_plan_steps_plan
  on public.marketing_plan_steps (plan_id, step_order);

create index if not exists idx_marketing_plan_steps_pending
  on public.marketing_plan_steps (status)
  where status = 'pending';

alter table public.marketing_plans enable row level security;
alter table public.marketing_plan_steps enable row level security;

create policy marketing_plans_select_own
  on public.marketing_plans for select to authenticated
  using (exists (select 1 from public.agents a where a.id = marketing_plans.agent_id and a.auth_user_id = auth.uid()));

create policy marketing_plans_insert_own
  on public.marketing_plans for insert to authenticated
  with check (exists (select 1 from public.agents a where a.id = marketing_plans.agent_id and a.auth_user_id = auth.uid()));

create policy marketing_plans_update_own
  on public.marketing_plans for update to authenticated
  using (exists (select 1 from public.agents a where a.id = marketing_plans.agent_id and a.auth_user_id = auth.uid()));

create policy marketing_plan_steps_select_own
  on public.marketing_plan_steps for select to authenticated
  using (exists (
    select 1 from public.marketing_plans p
    join public.agents a on a.id = p.agent_id
    where p.id = marketing_plan_steps.plan_id and a.auth_user_id = auth.uid()
  ));

create policy marketing_plan_steps_update_own
  on public.marketing_plan_steps for update to authenticated
  using (exists (
    select 1 from public.marketing_plans p
    join public.agents a on a.id = p.agent_id
    where p.id = marketing_plan_steps.plan_id and a.auth_user_id = auth.uid()
  ));
