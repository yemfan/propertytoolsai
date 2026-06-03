-- Week 22: CRM pipeline stages
-- ─────────────────────────────────────────────────────────────────────────────

-- Add pipeline tracking columns to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS pipeline_stage      TEXT        NOT NULL DEFAULT 'lead'
    CHECK (pipeline_stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  ADD COLUMN IF NOT EXISTS expected_value      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pipeline_note       TEXT,
  ADD COLUMN IF NOT EXISTS stage_changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Speed up pipeline board queries
CREATE INDEX IF NOT EXISTS idx_clients_pipeline
  ON clients (organization_id, pipeline_stage, stage_changed_at DESC);
