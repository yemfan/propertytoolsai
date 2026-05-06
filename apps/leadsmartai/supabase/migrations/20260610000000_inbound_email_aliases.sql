-- Inbound email forwarding (Phase 1)
--
-- Each agent gets a unique forwarding address like
--   agent-michael-7f3a@inbox.leadsmart-ai.com
-- They set up a Gmail filter to forward listing-related emails to that
-- address. SendGrid Inbound Parse POSTs to /api/inbound/forwarded-email,
-- which uses the local_part of the recipient to look up the agent and
-- create a "Review auto-imported email" task.
--
-- Why a separate table (not a column on agents): per-agent rotation,
-- multiple aliases per agent (one for offers, one for showings if the
-- agent wants), and so we can set up alias-level filters / policies
-- without touching the agents row.

create table if not exists public.agent_inbound_aliases (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  -- The unique local_part — everything before the @ in the forwarding
  -- address. Lowercase, alphanumeric + hyphens. Provider-side filtering
  -- enforces the same shape so we never get weird incoming targets.
  local_part text not null,
  -- Free-form label so an agent can have multiple aliases for different
  -- workflows ("offers", "showings"). Optional.
  label text,
  -- Last time SendGrid Inbound Parse delivered an email for this alias.
  -- Drives the "Last received" timestamp on the agent's UI panel.
  last_received_at timestamptz,
  -- Total count of emails routed through this alias. Used for the
  -- "Email forwarding" panel's "N emails imported" stat.
  inbound_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_inbound_aliases_local_part_unique unique (local_part),
  constraint agent_inbound_aliases_local_part_format check (
    local_part ~ '^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$'
  )
);

create index if not exists agent_inbound_aliases_agent_id_idx
  on public.agent_inbound_aliases (agent_id);
