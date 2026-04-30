-- Idempotency ledger for the trigger scheduler. One row per
-- (contact, template, period_key) — e.g. "anniversary:2024", "equity:25",
-- "quarter:2026Q2", "dormancy", "once_per_milestone:0.5". A unique constraint
-- means the scheduler can naively upsert and duplicates are dropped at the DB
-- layer instead of requiring a read-modify-write dance per contact.
--
-- Spec §2.4: "every trigger produces a draft; nothing ever sends without
-- agent approval in the first 30 days." The draft_id FK captures which draft
-- this firing produced (or null if the firing was suppressed by a guardrail
-- at creation time — e.g. agent-of-record mismatch).

create table if not exists public.trigger_firings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid null,     -- denormalized from contact for fast per-agent queries
  contact_id uuid not null references public.sphere_contacts(id) on delete cascade,
  template_id text not null references public.templates(id) on delete cascade,
  period_key text not null,
  draft_id uuid null references public.message_drafts(id) on delete set null,
  -- Why the trigger fired (anniversary year, equity pct, etc.) — audit trail.
  trigger_context jsonb not null default '{}'::jsonb,
  -- If the scheduler evaluated this trigger but suppressed it (e.g. opt-in
  -- missing, agent-of-record mismatch), record the reason so we don't re-fire.
  suppressed_reason text null,
  fired_at timestamptz not null default now(),
  unique (contact_id, template_id, period_key)
);

create index if not exists idx_trigger_firings_agent
  on public.trigger_firings(agent_id, fired_at desc);
create index if not exists idx_trigger_firings_draft
  on public.trigger_firings(draft_id)
  where draft_id is not null;

create or replace function public.trigger_firings_set_agent_id()
returns trigger
language plpgsql
as $$
begin
  if new.agent_id is null then
    select c.agent_id into new.agent_id
    from public.sphere_contacts c
    where c.id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trigger_firings_set_agent_id on public.trigger_firings;
create trigger trg_trigger_firings_set_agent_id
  before insert on public.trigger_firings
  for each row
  execute function public.trigger_firings_set_agent_id();

comment on table public.trigger_firings is
  'Idempotency ledger for the scheduler — one row per (contact, template, period). Dedups repeated cron passes.';
comment on column public.trigger_firings.period_key is
  'Stable bucket identifier, e.g. "anniversary:2024", "equity:25", "quarter:2026Q2", "dormancy", "once_per_milestone:0.5".';
