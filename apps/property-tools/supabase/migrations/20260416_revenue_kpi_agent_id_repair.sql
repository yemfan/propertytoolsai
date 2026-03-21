-- Repair: if 20260415 ran with hard-coded uuid agent_id while public.agents.id is bigint,
-- RLS creation fails with: operator does not exist: bigint = uuid
-- This migration drops the broken tables and recreates them with the correct agent_id type.

do $$
declare
  v_agents_id text;
  v_events_agent_id text;
  v_need_repair boolean := false;
begin
  select a.atttypid::regtype::text
    into v_agents_id
  from pg_attribute a
  where a.attrelid = 'public.agents'::regclass
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_agents_id is null then
    raise notice 'public.agents not found; skipping revenue KPI repair';
    return;
  end if;

  if to_regclass('public.agent_business_events') is not null then
    select format_type(a.atttypid, a.atttypmod)
      into v_events_agent_id
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'agent_business_events'
      and a.attname = 'agent_id'
      and a.attnum > 0
      and not a.attisdropped;

    if v_events_agent_id = 'uuid' and v_agents_id = 'bigint' then
      v_need_repair := true;
    end if;
  end if;

  if not v_need_repair then
    raise notice 'revenue KPI agent_id repair not needed';
    return;
  end if;

  raise notice 'Repairing revenue KPI tables: agent_id uuid -> bigint to match public.agents.id';

  drop policy if exists "agent_select_own_business_events" on public.agent_business_events;
  drop policy if exists "agent_select_own_revenue_transactions" on public.revenue_transactions;
  drop policy if exists "agent_select_own_kpi_alert_rules" on public.kpi_alert_rules;
  drop policy if exists "agent_select_own_kpi_alert_events" on public.kpi_alert_events;

  drop table if exists public.kpi_alert_events cascade;
  drop table if exists public.kpi_alert_rules cascade;
  drop table if exists public.revenue_transactions cascade;
  drop table if exists public.agent_business_events cascade;

  execute $sql$
    create table public.agent_business_events (
      id uuid primary key default gen_random_uuid(),
      agent_id bigint not null references public.agents(id) on delete cascade,
      event_name text not null,
      session_id text,
      properties jsonb not null default '{}'::jsonb,
      revenue_cents bigint,
      created_at timestamptz not null default now()
    )
  $sql$;

  execute $sql$
    create table public.revenue_transactions (
      id uuid primary key default gen_random_uuid(),
      agent_id bigint not null references public.agents(id) on delete cascade,
      amount_cents bigint not null,
      currency text not null default 'usd',
      category text not null default 'subscription',
      source text not null default 'manual',
      external_ref text,
      metadata jsonb not null default '{}'::jsonb,
      occurred_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  $sql$;

  execute $sql$
    create table public.kpi_alert_rules (
      id uuid primary key default gen_random_uuid(),
      agent_id bigint not null references public.agents(id) on delete cascade,
      metric_key text not null,
      operator text not null check (operator in ('lt', 'gt', 'lte', 'gte', 'eq')),
      threshold_numeric numeric not null,
      severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
      enabled boolean not null default true,
      cooldown_minutes int not null default 1440,
      last_triggered_at timestamptz,
      created_at timestamptz not null default now()
    )
  $sql$;

  execute $sql$
    create table public.kpi_alert_events (
      id uuid primary key default gen_random_uuid(),
      agent_id bigint not null references public.agents(id) on delete cascade,
      rule_id uuid references public.kpi_alert_rules (id) on delete set null,
      message text not null,
      observed_value numeric,
      created_at timestamptz not null default now()
    )
  $sql$;

  create unique index revenue_transactions_external_ref_unique
    on public.revenue_transactions (external_ref)
    where external_ref is not null;

  create index idx_agent_business_events_agent_created
    on public.agent_business_events (agent_id, created_at desc);

  create index idx_agent_business_events_agent_name_created
    on public.agent_business_events (agent_id, event_name, created_at desc);

  create index idx_agent_business_events_session
    on public.agent_business_events (agent_id, session_id, created_at desc);

  create index idx_revenue_transactions_agent_occurred
    on public.revenue_transactions (agent_id, occurred_at desc);

  create index idx_kpi_alert_rules_agent
    on public.kpi_alert_rules (agent_id, enabled);

  create unique index kpi_alert_rules_agent_metric_unique
    on public.kpi_alert_rules (agent_id, metric_key);

  create index idx_kpi_alert_events_agent_created
    on public.kpi_alert_events (agent_id, created_at desc);

  comment on table public.agent_business_events is
    'Funnel and product events per agent (e.g. funnel_view, funnel_lead_submit).';

  comment on table public.revenue_transactions is
    'Normalized revenue rows for MRR/revenue KPIs; Stripe webhook uses external_ref for idempotency.';

  alter table public.agent_business_events enable row level security;
  alter table public.revenue_transactions enable row level security;
  alter table public.kpi_alert_rules enable row level security;
  alter table public.kpi_alert_events enable row level security;

  create policy "agent_select_own_business_events"
    on public.agent_business_events for select
    using (
      exists (
        select 1 from public.agents a
        where a.id = agent_business_events.agent_id
          and a.auth_user_id = auth.uid()
      )
    );

  create policy "agent_select_own_revenue_transactions"
    on public.revenue_transactions for select
    using (
      exists (
        select 1 from public.agents a
        where a.id = revenue_transactions.agent_id
          and a.auth_user_id = auth.uid()
      )
    );

  create policy "agent_select_own_kpi_alert_rules"
    on public.kpi_alert_rules for select
    using (
      exists (
        select 1 from public.agents a
        where a.id = kpi_alert_rules.agent_id
          and a.auth_user_id = auth.uid()
      )
    );

  create policy "agent_select_own_kpi_alert_events"
    on public.kpi_alert_events for select
    using (
      exists (
        select 1 from public.agents a
        where a.id = kpi_alert_events.agent_id
          and a.auth_user_id = auth.uid()
      )
    );
end $$;
