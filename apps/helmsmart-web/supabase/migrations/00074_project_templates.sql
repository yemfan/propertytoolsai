-- Project Templates
-- Pre-defined project structures that can be used to create projects quickly

CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'indigo',
  budget_hours NUMERIC(8,2),
  hourly_rate NUMERIC(8,2),
  default_duration_days INT, -- suggested project length

  -- Default task definitions (JSON array of { title, priority, offset_days })
  -- offset_days = days after project start to set as due date
  default_tasks JSONB NOT NULL DEFAULT '[]',

  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_templates_org ON project_templates(organization_id);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage project templates"
  ON project_templates FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));
