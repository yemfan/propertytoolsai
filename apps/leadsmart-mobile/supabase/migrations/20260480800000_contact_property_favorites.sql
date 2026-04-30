-- contact_property_favorites — user-declared high-interest listings.
--
-- Complements contact_saved_searches (criteria-based intent) and
-- contact_events (behavioral signal): favorites are the strongest
-- consumer-declared interest we capture, because the user explicitly
-- chose "I like THIS house".
--
-- Snapshot fields (address, price, etc.) are stored at favorite-time
-- rather than fetched live so (1) the UI can render a user's
-- favorites even after a listing goes off-market and (2) the
-- agent-facing "suggested properties" query doesn't need a Rentcast
-- round-trip for every favorite it inspects.
--
-- Unique (contact_id, property_id) prevents double-favorites — the
-- consumer UI calls POST idempotently.

create table if not exists public.contact_property_favorites (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete set null,

  -- External listing identifier (Rentcast listing id). Not an FK
  -- because listings aren't stored as a local table yet.
  property_id text not null,

  -- Snapshot at favorite-time
  address text,
  city text,
  state text,
  zip text,
  price numeric,
  beds integer,
  baths numeric,
  sqft integer,
  property_type text,
  photo_url text,

  -- Consumer's personal note, e.g., "love the kitchen remodel"
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (contact_id, property_id)
);

create index if not exists idx_contact_favorites_contact
  on public.contact_property_favorites(contact_id, created_at desc);
create index if not exists idx_contact_favorites_agent
  on public.contact_property_favorites(agent_id, created_at desc)
  where agent_id is not null;

create or replace function public.touch_contact_favorites_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_contact_favorites_updated_at on public.contact_property_favorites;
create trigger trg_contact_favorites_updated_at
  before update on public.contact_property_favorites
  for each row execute function public.touch_contact_favorites_updated_at();

-- Bump property_favorite weight in the scoring engine? No schema
-- change needed — scoring.ts already weights property_favorite at 6.
-- Adding rows here fires the event directly via the API layer.
