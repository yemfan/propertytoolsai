-- AI Client Briefs
-- Cached Claude-generated summaries for each client, refreshable on demand

CREATE TABLE client_ai_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Generated content
  headline TEXT NOT NULL,          -- one-sentence status
  summary TEXT NOT NULL,           -- 2-3 paragraph brief
  next_action TEXT,                -- top recommended action
  health_score INT,                -- 1-10 relationship health
  health_label TEXT,               -- "At risk", "Good", "Excellent"
  key_facts JSONB NOT NULL DEFAULT '[]', -- array of { label, value } pairs

  -- Metadata
  model TEXT,                      -- claude model used
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, client_id)
);

CREATE INDEX idx_client_ai_briefs_org ON client_ai_briefs(organization_id);
CREATE INDEX idx_client_ai_briefs_client ON client_ai_briefs(client_id);

ALTER TABLE client_ai_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage client briefs"
  ON client_ai_briefs FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));
