-- AI-powered Smart Follow-Up automation (rules + logs)

-- Per-lead opt-out
alter table if exists public.leads
  add column if not exists automation_disabled boolean not null default false;

-- Rules
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null, -- report_view | high_engagement | inactivity
  condition jsonb not null default '{}'::jsonb,
  message_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_active on public.automation_rules(active);
create index if not exists idx_automation_rules_trigger_type on public.automation_rules(trigger_type);

-- Logs
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  message text not null,
  status text not null, -- sent | failed | skipped
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_logs_lead_id_created_at
  on public.automation_logs(lead_id, created_at desc);
create index if not exists idx_automation_logs_rule_id_created_at
  on public.automation_logs(rule_id, created_at desc);

-- Seed default rules (safe to re-run)
do $$
begin
  if not exists (select 1 from public.automation_rules where name = 'Report viewed follow-up') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'Report viewed follow-up',
      'report_view',
      jsonb_build_object('within_hours', 24),
      'Hi {{name}}, thanks for checking out your property report for {{address}}. Want me to run a quick CMA update and share the best next steps?',
      true
    );
  end if;

  if not exists (select 1 from public.automation_rules where name = 'High engagement follow-up') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'High engagement follow-up',
      'high_engagement',
      jsonb_build_object('min_score', 70),
      'Hi {{name}} — I noticed you’ve been actively reviewing your report for {{address}}. Are you open to a quick call to talk timing and pricing strategy?',
      true
    );
  end if;

  if not exists (select 1 from public.automation_rules where name = 'Inactivity re-engagement') then
    insert into public.automation_rules(name, trigger_type, condition, message_template, active)
    values (
      'Inactivity re-engagement',
      'inactivity',
      jsonb_build_object('inactive_days', 7),
      'Hi {{name}}, just checking in. If you’d like an updated snapshot for {{address}} or have any questions, I’m here to help. Should I check back next week?',
      true
    );
  end if;
end $$;

