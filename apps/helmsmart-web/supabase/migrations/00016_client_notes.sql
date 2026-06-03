-- Week 17: Client activity notes
-- ─────────────────────────────────────────────────────────────────────────────
-- Freeform notes attached to a client for logging interactions, follow-ups,
-- meeting summaries, etc.

CREATE TABLE client_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES auth.users(id),
  body            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'note'
                    CHECK (kind IN ('note','call','meeting','email','follow_up')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_notes_client ON client_notes (client_id, created_at DESC);
CREATE INDEX idx_client_notes_org    ON client_notes (organization_id, created_at DESC);

CREATE TRIGGER set_updated_at_client_notes
  BEFORE UPDATE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage client notes"
  ON client_notes FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
