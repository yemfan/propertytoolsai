-- E-signature integration: provider-agnostic envelope tracking.
--
-- Real estate transactions need signed disclosures, agreements,
-- amendments. Today the agent leaves the CRM for DocuSign/Dotloop
-- and copy-pastes status back. This table lets us track sent
-- envelopes inside the CRM, surfaced on the transaction detail
-- page, with status updated via webhook.
--
-- Provider-agnostic by design — `provider` text + `provider_id`
-- text. The first ride-on is Dotloop (the real-estate-native
-- option), but DocuSign / HelloSign can layer in without a schema
-- change.
--
-- Two tables:
--   - signature_envelopes: one row per envelope (the document set
--     sent for signature). Status canonicalized across providers.
--   - signature_events: append-only timeline (sent / viewed / signed
--     by signer X / completed / declined / voided). Same shape
--     used by PR-Z1's email_events.
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as recent migrations.

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
      create table if not exists public.signature_envelopes (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        provider text not null check (provider in ('dotloop','docusign','hellosign')),
        -- The provider's id for this envelope. Combined with provider,
        -- uniquely identifies the envelope at the source.
        provider_id text not null,
        -- Canonicalized status (mapped from provider-specific statuses).
        status text not null default 'sent' check (status in (
          'sent','viewed','signed','completed','declined','voided','expired'
        )),
        subject text not null default '',
        signers jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        sent_at timestamptz null,
        completed_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (provider, provider_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.signature_envelopes (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        provider text not null check (provider in ('dotloop','docusign','hellosign')),
        provider_id text not null,
        status text not null default 'sent' check (status in (
          'sent','viewed','signed','completed','declined','voided','expired'
        )),
        subject text not null default '',
        signers jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        sent_at timestamptz null,
        completed_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (provider, provider_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.signature_envelopes is
  'E-signature envelopes sent through Dotloop/DocuSign/HelloSign. Status canonicalized across providers; raw provider payloads land in signature_events.';

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes(id) on delete cascade,
  -- Provider's webhook delivery id. Unique to dedupe retries.
  external_event_id text unique,
  event_type text not null check (event_type in (
    'sent','viewed','signed','completed','declined','voided','expired','reminded'
  )),
  -- Index of the signer this event applies to (for 'signed'). Null for envelope-level events.
  signer_index int null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.signature_events is
  'Append-only timeline of e-signature webhook events. Signer-level events carry signer_index; envelope-level events leave it null.';

-- ── trigger: keep updated_at fresh on envelopes ────────────────

create or replace function public.set_signature_envelopes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists signature_envelopes_set_updated_at on public.signature_envelopes;
create trigger signature_envelopes_set_updated_at
  before update on public.signature_envelopes
  for each row execute procedure public.set_signature_envelopes_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_signature_envelopes_agent_status
  on public.signature_envelopes (agent_id, status);

create index if not exists idx_signature_envelopes_transaction
  on public.signature_envelopes (transaction_id)
  where transaction_id is not null;

create index if not exists idx_signature_envelopes_contact
  on public.signature_envelopes (contact_id)
  where contact_id is not null;

create index if not exists idx_signature_events_envelope_occurred
  on public.signature_events (envelope_id, occurred_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.signature_envelopes enable row level security;
alter table public.signature_events enable row level security;

-- Agents can read their own envelopes. All writes go through the
-- service role (webhook + create-envelope path).
drop policy if exists "signature_envelopes_select_own" on public.signature_envelopes;
create policy "signature_envelopes_select_own"
  on public.signature_envelopes
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = signature_envelopes.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Events follow the parent envelope.
drop policy if exists "signature_events_select_own" on public.signature_events;
create policy "signature_events_select_own"
  on public.signature_events
  for select
  using (
    exists (
      select 1 from public.signature_envelopes e
      join public.agents a on a.id = e.agent_id
      where e.id = signature_events.envelope_id
        and a.auth_user_id = auth.uid()
    )
  );
