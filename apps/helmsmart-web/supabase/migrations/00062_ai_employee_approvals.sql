-- Phase 3: approval queue for act_with_approval employees.
-- When an employee's autonomy is "act_with_approval", proposed actions land here
-- before executing. The owner approves or rejects from the dashboard or notification.
-- Approved rows trigger the queued action; rejected rows close the run as escalated.

create table if not exists ai_employee_approvals (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  employee_id     uuid        not null references ai_employees(id) on delete cascade,
  run_id          uuid        references ai_employee_runs(id) on delete set null,

  channel         text,                                    -- 'sms' | 'email' | 'voice' | 'internal'
  subject         jsonb       not null default '{}'::jsonb, -- trigger context (from, body preview, …)
  tool_key        text        not null,                    -- the action the employee wants to take
  tool_input      jsonb       not null default '{}'::jsonb, -- its arguments

  status          text        not null default 'pending'
                                check (status in ('pending','approved','rejected','expired')),
  decided_by      uuid        references auth.users(id) on delete set null,
  decided_at      timestamptz,
  expires_at      timestamptz not null default now() + interval '48 hours',
  created_at      timestamptz not null default now()
);

create index if not exists ai_employee_approvals_org_pending_idx
  on ai_employee_approvals(organization_id, status, created_at desc)
  where status = 'pending';

alter table ai_employee_approvals enable row level security;

create policy "org_members_ai_employee_approvals" on ai_employee_approvals for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
