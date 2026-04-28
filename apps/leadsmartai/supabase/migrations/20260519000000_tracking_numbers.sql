-- Per-source vanity / call-tracking numbers.
--
-- Each tracking number is a Twilio phone number assigned to a
-- specific marketing source (Zillow Premier, Facebook Ads, "yard
-- sign at 123 Main St", etc.). When inbound voice / SMS hits that
-- number, the inbound handler reads `tracking_numbers.source_label`
-- and stamps the lead's `source` accordingly.
--
-- Pairs with the existing lib/leadSourceRoi/ infra: ROI by source
-- now reflects ACTUAL inbound traffic to each number, not just
-- form attribution. Closes the loop on the gap-analysis "vanity /
-- call-tracking numbers" item.
--
-- Schema notes:
--   - phone_e164 is GLOBALLY unique — Twilio only owns each number
--     once, so two agents can't both claim it
--   - forward_to_phone is optional. When set, the inbound voice
--     route bridges the call to this number; when null, falls back
--     to the agent's own phone (agents.phone or agent_profiles.phone)
--   - is_active lets agents pause a number without deleting it
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
      create table if not exists public.tracking_numbers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        phone_e164 text not null,
        source_label text not null,
        forward_to_phone text null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (phone_e164)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.tracking_numbers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        phone_e164 text not null,
        source_label text not null,
        forward_to_phone text null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (phone_e164)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.tracking_numbers is
  'Per-source vanity Twilio numbers. Inbound calls/SMS to phone_e164 inherit source_label, feeding lead-source ROI attribution.';

comment on column public.tracking_numbers.forward_to_phone is
  'Optional bridge target. Null = ring the agent''s own phone. E.164 format.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_tracking_numbers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracking_numbers_set_updated_at on public.tracking_numbers;
create trigger tracking_numbers_set_updated_at
  before update on public.tracking_numbers
  for each row execute procedure public.set_tracking_numbers_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

-- "Lookup by phone number" is the inbound hot path — covered by
-- the unique constraint already, no extra index needed.

-- "Show me my numbers" — agent dashboard.
create index if not exists idx_tracking_numbers_agent_active
  on public.tracking_numbers (agent_id, is_active);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.tracking_numbers enable row level security;

drop policy if exists "tracking_numbers_select_own" on public.tracking_numbers;
create policy "tracking_numbers_select_own"
  on public.tracking_numbers
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_insert_own" on public.tracking_numbers;
create policy "tracking_numbers_insert_own"
  on public.tracking_numbers
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_update_own" on public.tracking_numbers;
create policy "tracking_numbers_update_own"
  on public.tracking_numbers
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "tracking_numbers_delete_own" on public.tracking_numbers;
create policy "tracking_numbers_delete_own"
  on public.tracking_numbers
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = tracking_numbers.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
