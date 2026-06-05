-- Business Insights — Tim (AI CIO) weekly intelligence digests
CREATE TABLE business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period covered
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Generated content
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]',
  metrics_snapshot JSONB,

  -- Metadata
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, period_start)
);

CREATE INDEX idx_business_insights_org ON business_insights(organization_id);
CREATE INDEX idx_business_insights_period ON business_insights(organization_id, period_start DESC);

ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view business insights"
  ON business_insights FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));
