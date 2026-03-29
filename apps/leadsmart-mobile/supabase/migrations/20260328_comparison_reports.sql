-- AI Property Comparison Reports (shareable public links + PDF export)

create table if not exists public.comparison_reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  client_name text not null default '',
  properties jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Optional FK when agents.id is uuid (safe if table exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agents'
  ) then
    alter table public.comparison_reports
      drop constraint if exists comparison_reports_agent_id_fkey;
    alter table public.comparison_reports
      add constraint comparison_reports_agent_id_fkey
      foreign key (agent_id) references public.agents(id) on delete cascade;
  end if;
exception when others then
  null;
end $$;

create index if not exists idx_comparison_reports_agent_created
  on public.comparison_reports(agent_id, created_at desc);

comment on table public.comparison_reports is 'Agent-generated property comparison reports; public read via server routes only';
