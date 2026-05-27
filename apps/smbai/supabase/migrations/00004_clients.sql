-- ============================================================
-- Migration 00004: Clients CRM
-- ============================================================
-- Simple contact/client management, org-scoped with full RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Core identity
  first_name        text        NOT NULL,
  last_name         text,
  company           text,
  email             text,
  phone             text,
  -- Classification
  status            text        NOT NULL DEFAULT 'lead'
                      CHECK (status IN ('lead', 'prospect', 'active', 'inactive', 'archived')),
  source            text,       -- e.g. 'referral', 'website', 'social'
  tags              text[],
  -- Notes / context
  notes             text,
  -- Revenue tracking (denormalized for fast display; updated by ledger)
  lifetime_value    numeric(14,2) NOT NULL DEFAULT 0,
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_org_id_idx     ON clients(organization_id);
CREATE INDEX IF NOT EXISTS clients_status_idx     ON clients(organization_id, status);
CREATE INDEX IF NOT EXISTS clients_email_idx      ON clients(organization_id, email);

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can select clients"
  ON clients FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can insert clients"
  ON clients FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can update clients"
  ON clients FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can delete clients"
  ON clients FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));
