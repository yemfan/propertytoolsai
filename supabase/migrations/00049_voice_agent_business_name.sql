-- Optional per-business display name the voice receptionist uses when it speaks
-- (greeting + prompt + the {{business_name}} variable), e.g. a brand or DBA name
-- distinct from the legal entity name in Settings. Blank = fall back to the
-- organization's name. Lets us onboard a customer whose receptionist should
-- announce a different name than their account/billing name.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_business_name text;
