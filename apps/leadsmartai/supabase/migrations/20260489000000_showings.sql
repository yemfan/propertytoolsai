-- Buyer-side showing workflow. Two tables:
--
--   showings          — one row per scheduled property visit
--   showing_feedback  — per-visit outcome (rating + pros/cons + offer flag).
--                       Separate table so we can add a visit that hasn't
--                       happened yet (no feedback) without forcing NULL
--                       soup on 10 columns. Also keeps feedback history
--                       (if an agent re-visits, we can add a second
--                       feedback row later.)
--
-- Why a dedicated subsystem vs tacking onto contacts:
--   A buyer attends 5-20 showings before writing an offer. The per-showing
--   record needs its own timestamp, access info, and listing-agent
--   contact — all property-specific, not buyer-specific. Stuffing it on
--   `contacts` would force a one-to-many hack.
--
-- Relationship to transactions:
--   `showings` is PRE-contract. Once a buyer writes a ratified offer,
--   the deal moves to `transactions`. No FK yet between the two — a
--   single buyer may have 20 showings and 0 transactions, and one
--   transaction may cover a property that was never a "showing" in our
--   system (off-market deal, buyer found it themselves).
--
-- Dual-type agent_id pattern — same as transactions migrations.

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
      create table if not exists public.showings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,           -- public listing link for quick reference

        scheduled_at timestamptz not null,
        duration_minutes int default 30,

        -- Access info lives inline (not a separate table) because it's
        -- one short blob per showing and never updated after the visit.
        access_notes text,      -- "lockbox 4-3-2-1, gate open, side door"
        listing_agent_name text,
        listing_agent_email text,
        listing_agent_phone text,

        status text not null default 'scheduled'
          check (status in ('scheduled', 'attended', 'cancelled', 'no_show')),
        cancellation_reason text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.showing_feedback (
        id uuid primary key default gen_random_uuid(),
        showing_id uuid not null references public.showings(id) on delete cascade,

        -- 1-5 for quick sort; overall_reaction is the soft qualitative tag.
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),

        pros text,
        cons text,
        notes text,

        would_offer boolean not null default false,
        price_concerns boolean not null default false,
        location_concerns boolean not null default false,
        condition_concerns boolean not null default false,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.showings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,

        scheduled_at timestamptz not null,
        duration_minutes int default 30,

        access_notes text,
        listing_agent_name text,
        listing_agent_email text,
        listing_agent_phone text,

        status text not null default 'scheduled'
          check (status in ('scheduled', 'attended', 'cancelled', 'no_show')),
        cancellation_reason text,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.showing_feedback (
        id uuid primary key default gen_random_uuid(),
        showing_id uuid not null references public.showings(id) on delete cascade,

        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),

        pros text,
        cons text,
        notes text,

        would_offer boolean not null default false,
        price_concerns boolean not null default false,
        location_concerns boolean not null default false,
        condition_concerns boolean not null default false,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- List queries are always "this agent's showings, recent first" or
-- "this buyer's showings." These two indexes cover both.
create index if not exists idx_showings_agent_scheduled
  on public.showings (agent_id, scheduled_at desc);

create index if not exists idx_showings_contact_scheduled
  on public.showings (contact_id, scheduled_at desc);

create index if not exists idx_showing_feedback_showing
  on public.showing_feedback (showing_id);

-- One feedback per showing for the MVP. If we later support multi-visit
-- feedback (same property, later re-visit), drop this and the UI groups
-- by created_at instead. Keep it simple for now.
create unique index if not exists uniq_showing_feedback_showing
  on public.showing_feedback (showing_id);
