-- Listing presentations.
--
-- The seller-facing pitch deck an agent assembles when they're
-- competing for a listing. Real-estate-specific composite of
-- artifacts the CRM already produces:
--   - cover (property address + agent branding)
--   - cma (comparable sales — from lib/cma/)
--   - pricing_strategy (target list + recommended range)
--   - marketing_plan (from lib/marketing/)
--   - agent_bio + testimonials (from #203)
--   - net_to_seller (from lib/listing-offers/)
--   - next_steps
--
-- This table holds the state of one presentation per (agent,
-- property). The `sections` JSONB array drives which slides
-- render and in what order — agents can drag-reorder or hide
-- sections without a schema change.
--
-- Sharing model: a `shareable_token` (hashed) is the URL the
-- agent texts to the seller. Token-only auth keeps the seller
-- out of the agent's CRM session.
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
      create table if not exists public.listing_presentations (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        property_address text not null,
        property_city text null,
        property_state text null,
        property_zip text null,
        suggested_list_price numeric(14, 2) null,
        suggested_list_low numeric(14, 2) null,
        suggested_list_high numeric(14, 2) null,
        sections jsonb not null default '[]'::jsonb,
        status text not null default 'draft' check (status in (
          'draft','ready','shared','closed','archived'
        )),
        -- Hashed shareable token. Raw token only ever leaves the
        -- server in the link the agent shares.
        share_token_hash text null unique,
        shared_with_email text null,
        shared_at timestamptz null,
        viewed_at timestamptz null,
        view_count int not null default 0,
        rendered_pdf_url text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.listing_presentations (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        property_address text not null,
        property_city text null,
        property_state text null,
        property_zip text null,
        suggested_list_price numeric(14, 2) null,
        suggested_list_low numeric(14, 2) null,
        suggested_list_high numeric(14, 2) null,
        sections jsonb not null default '[]'::jsonb,
        status text not null default 'draft' check (status in (
          'draft','ready','shared','closed','archived'
        )),
        share_token_hash text null unique,
        shared_with_email text null,
        shared_at timestamptz null,
        viewed_at timestamptz null,
        view_count int not null default 0,
        rendered_pdf_url text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.listing_presentations is
  'Seller-facing pitch decks composed from CMA + marketing plan + testimonials + net-to-seller. sections JSONB drives slide order; share_token_hash gates the public seller view.';

comment on column public.listing_presentations.sections is
  'Ordered array of section descriptors: [{type:"cma",enabled:true,config:{...}}, ...]. Type values match the SECTION_KINDS enum in lib/listing-presentations/sections.ts.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_listing_presentations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_presentations_set_updated_at on public.listing_presentations;
create trigger listing_presentations_set_updated_at
  before update on public.listing_presentations
  for each row execute procedure public.set_listing_presentations_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_listing_presentations_agent_status
  on public.listing_presentations (agent_id, status, created_at desc);

create index if not exists idx_listing_presentations_contact
  on public.listing_presentations (contact_id)
  where contact_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.listing_presentations enable row level security;

drop policy if exists "listing_presentations_select_own" on public.listing_presentations;
create policy "listing_presentations_select_own"
  on public.listing_presentations
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_insert_own" on public.listing_presentations;
create policy "listing_presentations_insert_own"
  on public.listing_presentations
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_update_own" on public.listing_presentations;
create policy "listing_presentations_update_own"
  on public.listing_presentations
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "listing_presentations_delete_own" on public.listing_presentations;
create policy "listing_presentations_delete_own"
  on public.listing_presentations
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = listing_presentations.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
