-- Per-business name for the voice receptionist (e.g. "Maria"), so the agent can
-- introduce itself by name. Configured on the Voice page and woven into the
-- per-business system prompt and greeting. NULL/empty = the agent stays unnamed.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_agent_name text;
