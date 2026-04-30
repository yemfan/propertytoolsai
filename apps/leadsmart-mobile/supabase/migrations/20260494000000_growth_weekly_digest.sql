-- Weekly Growth & Opportunities digest email.
--
-- Runs every Monday morning, picks the top 3 AI-generated opportunities
-- for each active agent, and sends a summary email. Turns the dashboard
-- feature from pull (agent opens tab) to push (agent sees it Monday
-- morning).
--
-- Two additions:
--   1. `growth_digest_enabled` on agent_notification_preferences —
--      per-agent opt-out. Defaults to on, same shape as the other
--      digest toggles.
--   2. `growth_digest_log` — dedupe + audit trail. Unique per
--      (agent_id, digest_date) so Vercel cron retries don't
--      double-send. Mirrors the transaction_nudge_log pattern.

alter table public.agent_notification_preferences
  add column if not exists growth_digest_enabled boolean not null default true;

comment on column public.agent_notification_preferences.growth_digest_enabled is
  'Weekly Growth & Opportunities email digest. Defaults on — the feature sends only when the agent has 2+ opportunities, so inactive agents won''t get noise anyway.';

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
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.growth_digest_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        digest_date date not null,
        opportunity_count int not null default 0,
        email_sent boolean not null default false,
        skipped_reason text,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.growth_digest_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        digest_date date not null,
        opportunity_count int not null default 0,
        email_sent boolean not null default false,
        skipped_reason text,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_growth_digest_log_agent_date
  on public.growth_digest_log (agent_id, digest_date desc);
