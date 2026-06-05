-- Workflow Approval Chains
-- Multi-step sequential approvals for business processes
-- (estimates, large expenses, project sign-offs, etc.)

CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- e.g. "Large Purchase Approval", "Estimate Sign-off"
  description TEXT,
  trigger_type TEXT NOT NULL, -- estimate_over_amount, expense_over_amount, manual, custom
  trigger_config JSONB NOT NULL DEFAULT '{}', -- e.g. { "amount_threshold": 5000 }
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  step_order INT NOT NULL, -- 1, 2, 3…
  step_name TEXT NOT NULL, -- e.g. "Manager review", "Finance sign-off"
  approver_role TEXT, -- owner, admin, bookkeeper — if set, any member with this role can approve
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- specific user approver
  timeout_hours INT, -- auto-escalate after N hours (NULL = no timeout)
  allow_delegate BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workflow_id, step_order)
);

CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES approval_workflows(id),

  -- What's being approved
  subject_type TEXT NOT NULL, -- estimate, expense, invoice, custom
  subject_id UUID, -- FK to the relevant record
  subject_label TEXT NOT NULL, -- human-readable e.g. "Estimate #EST-0042 — $12,500"
  subject_data JSONB, -- snapshot of key fields at time of request

  -- Who requested
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Current state
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled, expired
  current_step INT NOT NULL DEFAULT 1,
  final_decided_at TIMESTAMPTZ,
  final_decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_request_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_step_id UUID NOT NULL REFERENCES approval_workflow_steps(id),

  step_order INT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, skipped

  -- Who decided
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  note TEXT, -- optional comment from approver

  -- Auto-escalation tracking
  reminded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- derived from timeout_hours

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_approval_workflows_org ON approval_workflows(organization_id);
CREATE INDEX idx_approval_workflow_steps_workflow ON approval_workflow_steps(workflow_id);
CREATE INDEX idx_approval_requests_org ON approval_requests(organization_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(organization_id, status);
CREATE INDEX idx_approval_requests_subject ON approval_requests(subject_type, subject_id);
CREATE INDEX idx_approval_request_steps_request ON approval_request_steps(request_id);

-- RLS
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_request_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage approval workflows"
  ON approval_workflows FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can manage workflow steps"
  ON approval_workflow_steps FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can view approval requests"
  ON approval_requests FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org members can view approval request steps"
  ON approval_request_steps FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));
