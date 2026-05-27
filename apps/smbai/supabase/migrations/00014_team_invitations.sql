-- Week 14: Team invitations
-- ─────────────────────────────────────────────────────────────────────────────
-- Pending invitations that haven't been accepted yet.
-- A UUID token is emailed to the invitee; they visit /join/[token] to accept.

CREATE TABLE team_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin','bookkeeper','viewer')),
  token           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_invitations_token ON team_invitations (token) WHERE accepted_at IS NULL;
CREATE INDEX idx_team_invitations_org   ON team_invitations (organization_id, created_at DESC);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Org admins/owners can view and manage invitations for their org
CREATE POLICY "admins can manage invitations"
  ON team_invitations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND   role IN ('owner','admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND   role IN ('owner','admin')
    )
  );
