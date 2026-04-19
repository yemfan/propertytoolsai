-- Agent photo (headshot) — separate from logo_url.
--
-- Real-estate email signatures typically have TWO images:
--   - Headshot (circular, ~80px, next to the agent's name)
--   - Brokerage logo (rectangular, ~120×40px, lower-right)
-- 20260477000000_agent_branding already added logo_url; this adds
-- agent_photo_url so the signature composer can render both slots
-- independently without the agent having to choose.

alter table public.agents
  add column if not exists agent_photo_url text;

comment on column public.agents.agent_photo_url is
  'Agent headshot (circular) — separate from logo_url (brokerage logo). Used in email signatures.';
