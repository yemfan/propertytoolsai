-- Re-engagement campaigns: per-agent sequences + send logs.
-- agent_id follows public.agents.id (uuid or bigint). lead_id is bigint.

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.reengagement_campaigns (
        id uuid primary key default gen_random_uuid(),
        name text,
        agent_id uuid not null references public.agents(id) on delete cascade,
        status text not null default 'active'
          check (status in ('active', 'paused', 'archived')),
        channel text not null default 'sms'
          check (channel in ('sms', 'email')),
        trigger_type text not null default 'cold_lead'
          check (trigger_type in ('cold_lead', 'no_activity', 'anniversary', 'custom')),
        days_inactive integer not null default 30
          check (days_inactive >= 1 and days_inactive <= 730),
        max_per_run integer not null default 25
          check (max_per_run >= 1 and max_per_run <= 500),
        use_ai boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.reengagement_campaigns (
        id uuid primary key default gen_random_uuid(),
        name text,
        agent_id bigint not null references public.agents(id) on delete cascade,
        status text not null default 'active'
          check (status in ('active', 'paused', 'archived')),
        channel text not null default 'sms'
          check (channel in ('sms', 'email')),
        trigger_type text not null default 'cold_lead'
          check (trigger_type in ('cold_lead', 'no_activity', 'anniversary', 'custom')),
        days_inactive integer not null default 30
          check (days_inactive >= 1 and days_inactive <= 730),
        max_per_run integer not null default 25
          check (max_per_run >= 1 and max_per_run <= 500),
        use_ai boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for reengagement_campaigns: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_reengagement_campaigns_agent_status
  on public.reengagement_campaigns(agent_id, status);

create table if not exists public.reengagement_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.reengagement_campaigns(id) on delete cascade,
  step_number integer not null check (step_number >= 0),
  delay_days integer not null default 0
    check (delay_days >= 0 and delay_days <= 365),
  step_type text not null default 'nudge'
    check (step_type in ('initial', 'nudge', 'last_attempt', 'custom')),
  template text,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_number)
);

comment on column public.reengagement_messages.delay_days is
  'Days after the first step (step 0) send when this step is due. E.g. 0, 2, 5 for a 3-touch sequence.';

create index if not exists idx_reengagement_messages_campaign
  on public.reengagement_messages(campaign_id, step_number);

create table if not exists public.reengagement_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.reengagement_campaigns(id) on delete cascade,
  step_number integer not null,
  channel text not null check (channel in ('sms', 'email')),
  status text not null default 'sent'
    check (status in ('sent', 'skipped', 'failed')),
  body text not null default '',
  response text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reengagement_logs_lead_campaign
  on public.reengagement_logs(lead_id, campaign_id, created_at desc);

create index if not exists idx_reengagement_logs_campaign_created
  on public.reengagement_logs(campaign_id, created_at desc);
