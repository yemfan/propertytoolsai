-- agent_property_recommendations — agent-curated "here are N homes
-- I picked for you" sends.
--
-- The agent picks listings (from search, comps, AI suggestions, or
-- their own favorites list) + writes a personal note. One row per
-- send, tracking opens + clicks per the listing_alert_opened /
-- listing_alert_clicked pattern already used for saved-search
-- digests. Click data flows back into contact_events via the
-- /api/alerts/click redirect which dedups by presence of
-- recommendation_id vs saved_search_id in the querystring.

create table if not exists public.agent_property_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  -- Subject + personal note composed by the agent
  subject text,
  note text,

  -- Listings payload. Each entry carries a snapshot (address, price,
  -- beds/baths/sqft, photo_url, property_type) so the email template
  -- renders without re-fetching, and the tracking landing still works
  -- if the listing goes off-market before the recipient opens.
  -- Shape:
  --   [{ property_id, address, city, state, zip, price, beds, baths,
  --      sqft, property_type, photo_url }]
  listings jsonb not null default '[]'::jsonb,

  sent_at timestamptz,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  click_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_property_recs_contact
  on public.agent_property_recommendations(contact_id, created_at desc);
create index if not exists idx_agent_property_recs_agent
  on public.agent_property_recommendations(agent_id, created_at desc);

create or replace function public.touch_agent_property_recs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_agent_property_recs_updated_at on public.agent_property_recommendations;
create trigger trg_agent_property_recs_updated_at
  before update on public.agent_property_recommendations
  for each row execute function public.touch_agent_property_recs_updated_at();
