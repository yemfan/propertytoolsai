-- ─── AI Workforce ──────────────────────────────────────────────────────────────
-- First-class AI employees: a definition/registry + per-employee tools, memory,
-- runs (instances) and metrics. Org-scoped, RLS via get_user_org_ids().
-- Depends on 00001 (organizations, organization_members, get_user_org_ids, set_updated_at).
-- See AI_Workforce_Design.md.
--
-- NOTE: ai_employee_memory.embedding (pgvector) is intentionally DEFERRED to the
-- Knowledge DNA vector-store migration — added then as a nullable column.

-- DNA module enum (the 10 Business DNA modules). Idempotent.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dna_module') then
    create type dna_module as enum (
      'revenue','marketing','service','operations','finance',
      'people','communication','knowledge','intelligence','platform'
    );
  end if;
end $$;

-- ── ai_employees ── the definition / registry row ───────────────────────────────
create table if not exists ai_employees (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  slug               text not null,
  name               text not null,
  role               text not null,
  department         text not null,
  dna_module         dna_module not null,
  industry_pack      text,
  goals              jsonb not null default '[]'::jsonb,
  knowledge_sources  jsonb not null default '[]'::jsonb,
  permissions        jsonb not null default '{}'::jsonb,
  model              text not null default 'gpt-4.1',
  personality        text not null default 'professional',
  status             text not null default 'active'
                       check (status in ('active','paused','draft')),
  config             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists ai_employees_org_idx        on ai_employees(organization_id);
create index if not exists ai_employees_org_module_idx on ai_employees(organization_id, dna_module);
alter table ai_employees enable row level security;
drop policy if exists "org_members_ai_employees" on ai_employees;
create policy "org_members_ai_employees" on ai_employees for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
create or replace trigger set_updated_at_ai_employees
  before update on ai_employees for each row execute function set_updated_at();

-- ── ai_employee_tools ── which DNA services this employee may call (references) ──
create table if not exists ai_employee_tools (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references ai_employees(id) on delete cascade,
  tool_key        text not null,
  dna_module      dna_module not null,
  enabled         boolean not null default true,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (employee_id, tool_key)
);
create index if not exists ai_employee_tools_org_idx on ai_employee_tools(organization_id);
alter table ai_employee_tools enable row level security;
drop policy if exists "org_members_ai_employee_tools" on ai_employee_tools;
create policy "org_members_ai_employee_tools" on ai_employee_tools for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ── ai_employee_memory ── per-org, per-subject memory (soft refs, no cross-DNA FK)
create table if not exists ai_employee_memory (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references ai_employees(id) on delete cascade,
  subject_type    text,
  subject_id      text,
  kind            text not null default 'episodic'
                    check (kind in ('episodic','semantic','summary')),
  content         text not null,
  importance      smallint not null default 0,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists ai_employee_memory_lookup_idx
  on ai_employee_memory(organization_id, employee_id, subject_type, subject_id);
alter table ai_employee_memory enable row level security;
drop policy if exists "org_members_ai_employee_memory" on ai_employee_memory;
create policy "org_members_ai_employee_memory" on ai_employee_memory for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ── ai_employee_runs ── one execution / conversation (instance) ─────────────────
create table if not exists ai_employee_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references ai_employees(id) on delete cascade,
  channel         text,
  subject_type    text,
  subject_id      text,
  status          text not null default 'running'
                    check (status in ('running','succeeded','failed','escalated')),
  outcome         jsonb not null default '{}'::jsonb,
  tokens_used     integer not null default 0,
  cost_cents      integer not null default 0,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index if not exists ai_employee_runs_org_emp_idx
  on ai_employee_runs(organization_id, employee_id, started_at desc);
alter table ai_employee_runs enable row level security;
drop policy if exists "org_members_ai_employee_runs" on ai_employee_runs;
create policy "org_members_ai_employee_runs" on ai_employee_runs for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ── ai_employee_metrics ── daily KPI rollup → Executive Command Center ──────────
create table if not exists ai_employee_metrics (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references ai_employees(id) on delete cascade,
  metric_date     date not null,
  metric_key      text not null,
  metric_value    numeric not null default 0,
  created_at      timestamptz not null default now(),
  unique (organization_id, employee_id, metric_date, metric_key)
);
create index if not exists ai_employee_metrics_lookup_idx
  on ai_employee_metrics(organization_id, employee_id, metric_date);
alter table ai_employee_metrics enable row level security;
drop policy if exists "org_members_ai_employee_metrics" on ai_employee_metrics;
create policy "org_members_ai_employee_metrics" on ai_employee_metrics for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
