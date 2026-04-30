-- agents.service_areas_v2 — structured state/county/city service area picks.
--
-- Context: the old `service_areas text[]` column stored free-form strings
-- like "alhambra,ca" or raw zip codes mixed together. The downstream
-- matcher in propertytoolsai/lib/matching.ts did substring/regex compares
-- which are fragile ("Los Angeles" matches "New Los Angeles" etc.) and
-- can't express "I serve all of this county".
--
-- New structured format stored as jsonb:
--   [
--     { "state": "CA", "county": "Los Angeles", "city": "Alhambra" },
--     { "state": "CA", "county": "Orange",      "city": null }     -- all cities
--   ]
--
-- Dual-write strategy: the new onboarding picker writes v2; the legacy
-- `service_areas` column continues to receive a flattened string array
-- ("city, state" / "All of county, state") for backwards compatibility
-- with any call sites still on the old format. Matcher reads v2 first
-- and falls back to v1.

alter table public.agents
  add column if not exists service_areas_v2 jsonb;

comment on column public.agents.service_areas_v2 is
  'Structured service-area picks: array of { state, county, city? } objects. '
  'city=null means the agent covers all cities in that county. '
  'Supersedes service_areas (free-form strings); matcher falls back to '
  'service_areas if this is null/empty.';

-- GIN index for downstream filtering (matcher queries will probe state/county).
create index if not exists agents_service_areas_v2_gin
  on public.agents
  using gin (service_areas_v2);
