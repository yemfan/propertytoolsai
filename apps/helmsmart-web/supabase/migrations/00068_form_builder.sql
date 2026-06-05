-- Form Builder & Lead Capture
-- Embeddable web forms that auto-create leads in the CRM

CREATE TABLE form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  slug TEXT NOT NULL, -- unique per org, used in public URL /f/[slug]
  title TEXT NOT NULL,
  description TEXT, -- shown above the form

  -- Fields definition (JSON array)
  -- Each field: { id, type, label, placeholder, required, options[] (for select) }
  fields JSONB NOT NULL DEFAULT '[]',

  -- Behavior
  success_message TEXT NOT NULL DEFAULT 'Thanks! We''ll be in touch shortly.',
  auto_create_client BOOLEAN NOT NULL DEFAULT true,
  notify_email TEXT, -- email to notify on submission (defaults to org owner)
  notify_sms BOOLEAN NOT NULL DEFAULT false, -- notify via SMS if org has Twilio
  redirect_url TEXT, -- optional redirect after submission

  -- Stats
  submission_count INT NOT NULL DEFAULT 0,

  -- Meta
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,

  -- Captured data
  data JSONB NOT NULL DEFAULT '{}', -- key: field.id, value: submitted value
  email TEXT, -- extracted for quick access
  phone TEXT, -- extracted for quick access
  name TEXT, -- extracted for quick access

  -- Link to CRM
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_form_definitions_org ON form_definitions(organization_id);
CREATE INDEX idx_form_definitions_slug ON form_definitions(organization_id, slug);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_org ON form_submissions(organization_id);
CREATE INDEX idx_form_submissions_client ON form_submissions(client_id);
CREATE INDEX idx_form_submissions_created ON form_submissions(created_at DESC);

-- RLS
ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Form definitions: org members only
CREATE POLICY "org members can select form definitions"
  ON form_definitions FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can insert form definitions"
  ON form_definitions FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can update form definitions"
  ON form_definitions FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can delete form definitions"
  ON form_definitions FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- Form submissions: org members only (public submissions go via service role API route)
CREATE POLICY "org members can select form submissions"
  ON form_submissions FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can delete form submissions"
  ON form_submissions FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));
