-- Per-agent override for the privacy policy URL on Meta Lead Ad
-- forms. Meta requires every Lead Ad lead form to point to a
-- privacy policy URL — for LeadSmart's bundled offering we default
-- to https://www.leadsmart-ai.com/privacy, but brokerages that
-- operate under their own brand prefer their own URL. This column
-- holds that override; null = use the LeadSmart default.

alter table public.agents
  add column if not exists lead_ad_privacy_policy_url text;

comment on column public.agents.lead_ad_privacy_policy_url is
  'Per-agent override for the Meta Lead Ad form privacy policy URL. Null = use the LeadSmart default (/privacy).';
