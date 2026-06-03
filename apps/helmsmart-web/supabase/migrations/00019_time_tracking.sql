-- Week 21: Time tracking & billable hours
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id         UUID        REFERENCES clients(id) ON DELETE SET NULL,

  project           TEXT,
  description       TEXT        NOT NULL DEFAULT '',

  -- Timer: null ended_at means the timer is currently running
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  duration_minutes  INT,          -- set on stop; may be overridden for manual entries

  billable          BOOLEAN     NOT NULL DEFAULT TRUE,
  hourly_rate       NUMERIC(10,2),   -- null = use org default or unrated

  -- Invoice linkage
  invoiced          BOOLEAN     NOT NULL DEFAULT FALSE,
  invoice_id        UUID        REFERENCES invoices(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_org
  ON time_entries (organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_client
  ON time_entries (client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage time entries"
  ON time_entries FOR ALL
  USING  (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- Default hourly rate column on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC(10,2);
