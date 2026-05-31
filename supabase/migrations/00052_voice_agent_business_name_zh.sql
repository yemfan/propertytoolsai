-- Chinese business name for the voice receptionist. When the agent speaks Chinese
-- it refers to the business by this name; English uses voice_agent_business_name
-- (or the account name). Blank = fall back to the English/display name.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_business_name_zh text;
