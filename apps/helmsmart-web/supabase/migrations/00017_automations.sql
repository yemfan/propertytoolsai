-- Week 18: Automation rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Simple trigger → action pairs. Evaluated server-side when trigger events fire.

CREATE TABLE automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  trigger         TEXT NOT NULL
                    CHECK (trigger IN (
                      'invoice_overdue',
                      'invoice_paid',
                      'new_lead',
                      'campaign_sent'
                    )),
  action          TEXT NOT NULL
                    CHECK (action IN (
                      'create_task',
                      'send_email',
                      'add_note'
                    )),
  -- action config (JSON): title, due_offset_days, email_subject, email_body, etc.
  config          JSONB NOT NULL DEFAULT '{}',
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_org ON automation_rules (organization_id, enabled, trigger);

CREATE TRIGGER set_updated_at_automation_rules
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage automation rules"
  ON automation_rules FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
