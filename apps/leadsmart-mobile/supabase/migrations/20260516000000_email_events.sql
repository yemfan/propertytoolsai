-- Resend email-event tracking.
--
-- The AI-email layer (lib/ai-email/send.ts) sends through Resend and
-- stores the resulting email_id on email_messages.external_message_id.
-- This table records what happened to those messages downstream:
-- delivered, opened, clicked, bounced, complained.
--
-- Source: Resend webhooks (delivered via Svix). The webhook handler
-- at app/api/webhooks/resend/route.ts verifies the signature, maps
-- the event to a row here, and joins to email_messages to resolve
-- the agent + lead.
--
-- Why a separate events table (vs. columns on email_messages):
--   - One outbound message can have many events (delivered + opened +
--     clicked × 3 + clicked × 5 different URLs). A flat row can't
--     model that without losing the per-link breakdown that makes
--     click tracking useful.
--   - Idempotent ingestion: Svix retries deliver the same event with
--     the same svix-id; the unique constraint on event_id rejects
--     duplicates without bespoke "have I seen this?" checks.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260514000000_agent_social_connections.sql and
-- 20260515000000_coaching_dismissals.sql.

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
      create table if not exists public.email_events (
        id uuid primary key default gen_random_uuid(),
        -- Resend's email_id (returned from POST /emails). Joins back
        -- to email_messages.external_message_id to find the agent/lead.
        external_message_id text not null,
        -- Svix delivery id. Unique to dedupe webhook retries.
        event_id text unique,
        agent_id uuid references public.agents(id) on delete set null,
        lead_id bigint,
        event_type text not null check (event_type in (
          'sent','delivered','delayed','opened','clicked','bounced','complained'
        )),
        -- Populated for 'clicked' events. Resend includes the link URL.
        url text,
        metadata jsonb not null default '{}'::jsonb,
        occurred_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.email_events (
        id uuid primary key default gen_random_uuid(),
        external_message_id text not null,
        event_id text unique,
        agent_id bigint references public.agents(id) on delete set null,
        lead_id bigint,
        event_type text not null check (event_type in (
          'sent','delivered','delayed','opened','clicked','bounced','complained'
        )),
        url text,
        metadata jsonb not null default '{}'::jsonb,
        occurred_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.email_events is
  'Per-event log of Resend email lifecycle (delivered/opened/clicked/etc). One outbound email_messages row can have many events here. Ingested by app/api/webhooks/resend/route.ts.';

comment on column public.email_events.event_id is
  'Svix delivery id (svix-id header). Unique so webhook retries are idempotent — duplicate inserts are rejected silently.';

comment on column public.email_events.url is
  'Click target for event_type=clicked. Null for other event types.';

-- ── indexes ─────────────────────────────────────────────────────

-- Primary lookup pattern: "for this agent, give me email events in a
-- time window for the dashboard / open-rate aggregation."
create index if not exists idx_email_events_agent_occurred
  on public.email_events (agent_id, occurred_at desc);

-- Per-lead timeline ("show every event for this contact").
create index if not exists idx_email_events_lead_occurred
  on public.email_events (lead_id, occurred_at desc);

-- Webhook handler joins on this when looking up agent_id / lead_id
-- from the email_messages row.
create index if not exists idx_email_events_external_id
  on public.email_events (external_message_id);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.email_events enable row level security;

-- Agents can only read their own events. Inserts/updates/deletes are
-- service-role only — the webhook handler runs with the service role
-- and is the sole writer.
drop policy if exists "email_events_select_own" on public.email_events;
create policy "email_events_select_own"
  on public.email_events
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = email_events.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
