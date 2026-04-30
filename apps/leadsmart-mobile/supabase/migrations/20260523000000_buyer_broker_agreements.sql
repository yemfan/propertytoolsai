-- Buyer Broker Agreements (BBA / Buyer Agency Agreement).
--
-- Required by the August 2024 NAR settlement: a US buyer must
-- sign a written agreement with their buyer's agent BEFORE the
-- agent can show them homes (varies by state, but most enforce
-- it). This table tracks the agreement's lifecycle so other
-- surfaces (showing scheduling, transaction creation) can gate
-- on "is there an active BBA on file?"
--
-- Plumbs through the e-sign infra from #199 / #201 — a BBA's
-- `signature_envelope_id` points to the envelope that sent it
-- to the buyer for signature. When the envelope hits 'completed',
-- a follow-up cron (or signature_events trigger downstream) flips
-- this row's status to 'signed' and stamps signed_at from the
-- envelope's completed_at.
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
      create table if not exists public.buyer_broker_agreements (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null,
        -- Two-letter US state code. Drives template selection +
        -- per-state expiry / exclusivity defaults.
        state_code text null,
        status text not null default 'draft' check (status in (
          'draft','sent','signed','declined','expired','terminated'
        )),
        is_exclusive boolean not null default true,
        -- Agreed buyer-side commission, e.g. 2.5%. Null when the
        -- agreement is fee-based or hasn't been filled in yet.
        buyer_commission_pct numeric(5, 2) null,
        flat_fee_amount numeric(12, 2) null,
        effective_start_date date null,
        effective_end_date date null,
        signed_at timestamptz null,
        terminated_at timestamptz null,
        terminated_reason text null,
        -- Optional: link to the e-sign envelope that delivered it.
        signature_envelope_id uuid null references public.signature_envelopes(id) on delete set null,
        pdf_url text null,
        notes text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.buyer_broker_agreements (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null,
        state_code text null,
        status text not null default 'draft' check (status in (
          'draft','sent','signed','declined','expired','terminated'
        )),
        is_exclusive boolean not null default true,
        buyer_commission_pct numeric(5, 2) null,
        flat_fee_amount numeric(12, 2) null,
        effective_start_date date null,
        effective_end_date date null,
        signed_at timestamptz null,
        terminated_at timestamptz null,
        terminated_reason text null,
        signature_envelope_id uuid null references public.signature_envelopes(id) on delete set null,
        pdf_url text null,
        notes text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.buyer_broker_agreements is
  'Buyer Broker Agreements (NAR-settlement-compliant). One row per (agent, contact) lifecycle; gate showings + transaction creation on status=signed AND not expired.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_buyer_broker_agreements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists buyer_broker_agreements_set_updated_at on public.buyer_broker_agreements;
create trigger buyer_broker_agreements_set_updated_at
  before update on public.buyer_broker_agreements
  for each row execute procedure public.set_buyer_broker_agreements_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Does this contact have an active BBA?" — hot-path gate query
-- on showing scheduling.
create index if not exists idx_bba_contact_status
  on public.buyer_broker_agreements (contact_id, status, effective_end_date desc);

-- Agent dashboard listing.
create index if not exists idx_bba_agent_status
  on public.buyer_broker_agreements (agent_id, status, created_at desc);

-- Renewal sweep: "find BBAs expiring in N days".
create index if not exists idx_bba_expiring_signed
  on public.buyer_broker_agreements (effective_end_date)
  where status = 'signed';

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.buyer_broker_agreements enable row level security;

drop policy if exists "bba_select_own" on public.buyer_broker_agreements;
create policy "bba_select_own"
  on public.buyer_broker_agreements
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_insert_own" on public.buyer_broker_agreements;
create policy "bba_insert_own"
  on public.buyer_broker_agreements
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_update_own" on public.buyer_broker_agreements;
create policy "bba_update_own"
  on public.buyer_broker_agreements
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "bba_delete_own" on public.buyer_broker_agreements;
create policy "bba_delete_own"
  on public.buyer_broker_agreements
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = buyer_broker_agreements.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
