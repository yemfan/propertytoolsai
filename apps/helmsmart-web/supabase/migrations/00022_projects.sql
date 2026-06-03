-- Week 24: Project management
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id         UUID        REFERENCES clients(id) ON DELETE SET NULL,

  name              TEXT        NOT NULL,
  description       TEXT,
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  color             TEXT        NOT NULL DEFAULT 'indigo'
                                CHECK (color IN ('indigo', 'emerald', 'rose', 'amber', 'violet', 'slate')),

  -- Budget
  budget_hours      NUMERIC(8,2),
  budget_amount     NUMERIC(12,2),
  hourly_rate       NUMERIC(10,2),

  -- Timeline
  start_date        DATE,
  end_date          DATE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org
  ON projects (organization_id, status, created_at DESC);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage projects"
  ON projects FOR ALL
  USING  (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- Link time entries and tasks to projects
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_project
  ON time_entries (project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks (project_id) WHERE project_id IS NOT NULL;
